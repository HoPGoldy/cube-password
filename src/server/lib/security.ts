import { DATE_FORMATTER, STATUS_CODE } from '@/config'
import { SecurityNoticeType } from '@/types/app'
import { AppKoaContext } from '@/types/global'
import { getReplayAttackData, validateReplayAttackData } from '@/utils/crypto'
import dayjs from 'dayjs'
import { Next } from 'koa'
import { createFileReader, getNoticeContentPrefix, response } from '../utils'
import { getGroupCollection, getReplayAttackNonceCollection, insertSecurityNotice } from './loki'
import { getRandomRoutePrefix } from './randomEntry'

export interface LoginRecordDetail {
    /**
     * 要显示的错误登录信息
     * 不一定是所有的，一般都是今天的错误信息
     */
    records: string[]
    /**
     * 是否被锁定
     */
    disable: boolean
    /**
     * 是否无限期锁定
     */
    dead: boolean
}

interface LoginLockProps {
    excludePath?: string[]
}

/**
 * 创建登录重试管理器
 * 同一天内最多失败三次，超过三次后锁定
 * 连续失败锁定两天后锁死应用后台，拒绝所有请求
 */
export const createLoginLock = () => {
    // 系统是被被锁定
    let loginDisabled = false
    // 解除锁定的计时器
    let unlockTimer: NodeJS.Timeout | undefined
    // 当前失败的登录次数日期
    const loginFailRecords: number[] = []

    /**
     * 增加登录失败记录
     */
    const recordLoginFail = () => {
        loginFailRecords.push(new Date().valueOf())

        // 如果今天失败三次了，就锁定
        const todayFail = loginFailRecords.filter(date => {
            return dayjs(date).isSame(dayjs(), 'day')
        })
        if (todayFail.length < 3) return
        loginDisabled = true

        // 如果昨天也失败了三次（也就是失败了两天），就不会在解除锁定了
        const yesterdayFail = loginFailRecords.filter(date => {
            return dayjs(date).isSame(dayjs().subtract(1, 'day'), 'day')
        })
        if (yesterdayFail.length >= 3) return
        // 24 小时后解除锁定
        unlockTimer = setTimeout(() => {
            loginDisabled = false
            unlockTimer = undefined
            console.log('登录失败次数过多导致的锁定已解除')
        }, 1000 * 60 * 60 * 24)
    }

    const clearRecord = () => {
        loginDisabled = false
        clearTimeout(unlockTimer)
        unlockTimer = undefined
        loginFailRecords.length = 0
    }

    /**
     * 获取当前登录失败情况
     */
    const getLockDetail = (): LoginRecordDetail => {
        const records = loginFailRecords
            .filter(date => {
                return dayjs(date).isSame(dayjs(), 'day')
            })
            .map(date => dayjs(date).format(DATE_FORMATTER))

        return {
            records,
            disable: loginDisabled,
            // 如果被禁用了，而且还没有解锁计时器，那就说明是永久锁定
            dead: loginDisabled && !unlockTimer
        }
    }

    const createCheckLoginDisable = (props: LoginLockProps) => {
        const { excludePath = [] } = props

        /**
         * 登录锁定中间件
         * 用于在锁定时拦截所有中间件
         */
        return async (ctx: AppKoaContext, next: Next) => {
            const isAccessPath = !!excludePath.find(path => ctx.url.endsWith(path))
            // 允许 excludePath 接口正常访问
            if (isAccessPath) return await next()

            try {
                if (loginDisabled) throw new Error('登录失败次数过多，请求被拒绝')
                await next()
            }
            catch (e)  {
                console.error(e)
                response(ctx, { code: 403, msg: '登录失败次数过多，请稍后再试' })
            }
        }
    }

    

    return { recordLoginFail, createCheckLoginDisable, getLockDetail, clearRecord }
}

export type LoginLocker = ReturnType<typeof createLoginLock>

type SecurityChecker = (ctx: AppKoaContext, next: Next) => Promise<unknown>

/**
 * 检查中间件 - 请求是否在睡觉时段进行
 */
export const checkIsSleepTime: SecurityChecker = async (ctx, next) => {
    await next()

    // 只记录登录行为
    if (!ctx.path.endsWith('/api/login')) return

    const requestHour = dayjs().hour()
    // 六点之后就不算睡觉时段了
    if (requestHour >= 6) return

    const prefix = await getNoticeContentPrefix(ctx)
    insertSecurityNotice(
        SecurityNoticeType.Info,
        '来自睡觉时段的登录',
        `${prefix}进行了一次登录，请确认是否为本人操作`,
    )
}

/**
 * 检查中间件 - 登录是否成功
 */
export const checkIsLoginSuccess: SecurityChecker = async (ctx, next) => {
    await next()

    if ((ctx.body as any)?.code === 200) return
    const prefix = await getNoticeContentPrefix(ctx)
    insertSecurityNotice(
        SecurityNoticeType.Warning,
        '登录失败',
        `${prefix}进行了一次失败的登录，请确认是否为本人操作`,
    )
}

/**
 * 检查中间件 - 分组解锁是否成功
 */
export const checkIsGroupUnlockSuccess: SecurityChecker = async (ctx, next) => {
    await next()
    if ((ctx.body as any)?.code === 200) return

    const collection = await getGroupCollection()
    const groupId = Number(ctx.params.groupId)
    const item = collection.get(groupId)

    let content = await getNoticeContentPrefix(ctx)
    if (!item) {
        content += `尝试解锁一个不存在的分组(分组 id: ${groupId})。`
        content += '正常使用不应该会产生此请求，请检查是否有攻击者尝试爆破分组密码'
    }
    else content += '进行了一次失败的解锁，请确认是否为本人操作'

    insertSecurityNotice(
        SecurityNoticeType.Warning,
        '分组解锁失败',
        content
    )
}

/**
 * 获取防重放密钥
 */
export const getReplayAttackSecret = createFileReader({ fileName: 'replayAttackSecret' })

/**
 * 创建检查中间件 - 防重放攻击
 */
export const createCheckReplayAttack = (options: { excludePath: string[] }) => {
    const checkReplayAttack: SecurityChecker = async (ctx, next) => {
        const routePrefix  = await getRandomRoutePrefix()
        // 请求的路径不是应用的服务路径，直接跳过（因为其他路径没有服务器），不然会误报
        const prefixMatched = ctx.path.startsWith(routePrefix)
        if (!prefixMatched) return await next()

        const isAccessPath = !!options.excludePath.find(path => ctx.url.endsWith(path))
        // 允许 excludePath 接口正常访问
        if (isAccessPath) return await next()

        try {
            const replayAttackData = getReplayAttackData(ctx)
            if (!replayAttackData) {
                throw new Error(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为未提供防重放攻击 header。`)
            }

            const replayAttackSecret = await getReplayAttackSecret()
            const nonceCollection = await getReplayAttackNonceCollection()
            // 如果有重复的随机码
            if (nonceCollection.findOne({ value: { '$eq': replayAttackData.nonce }})) {
                throw new Error(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为重复的 nonce。`)
            }

            const isValidate = validateReplayAttackData(replayAttackData, replayAttackSecret)
            if (!isValidate) {
                throw new Error(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为请求签名异常。`)
            }

            await next()
        }
        catch (e) {
            console.error(e)
            const prefix = await getNoticeContentPrefix(ctx)
            insertSecurityNotice(SecurityNoticeType.Info, '伪造请求', prefix + '发起了一次' + e.message)
            response(ctx, { code: STATUS_CODE.REPLAY_ATTACK, msg: '请求异常，请稍后再试' })
        }
    }

    return checkReplayAttack
}
