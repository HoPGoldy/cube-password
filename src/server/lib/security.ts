import { DATE_FORMATTER } from '@/config'
import { SecurityNoticeType } from '@/types/app'
import { AppKoaContext } from '@/types/global'
import dayjs from 'dayjs'
import { Next } from 'koa'
import { createLog } from '../router/logger'
import { getNoticeContentPrefix, response } from '../utils'
import { getGroupCollection, insertSecurityNotice } from './loki'

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
const createLoginLock = (props: LoginLockProps) => {
    const { excludePath = [] } = props
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

    /**
     * 登录锁定中间件
     * 用于在锁定时拦截所有中间件
     */
    const loginLockMiddleware = async (ctx: AppKoaContext, next: Next) => {
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

    return { recordLoginFail, loginLockMiddleware, getLockDetail, clearRecord }
}

const lockManager = createLoginLock({ excludePath: ['/global', '/logInfo']})
export { lockManager }

type SecurityChecker = (ctx: AppKoaContext, next: Next) => Promise<unknown>

/**
 * 检查中间件 - 请求是否在睡觉时段进行
 */
export const checkIsSleepTime: SecurityChecker = async (ctx, next) => {
    await next()

    const requestHour = dayjs().hour()
    // 六点之后就不算睡觉时段了
    if (requestHour >= 6) return

    insertSecurityNotice(
        SecurityNoticeType.Info,
        '来自睡觉时段的登录',
        `${getNoticeContentPrefix(ctx.log)}进行了一次登录，请确认是否为本人操作`,
    )
}

/**
 * 检查中间件 - 登录是否成功
 */
export const checkIsLoginSuccess: SecurityChecker = async (ctx, next) => {
    await next()

    if ((ctx.body as any)?.code === 200) return
    insertSecurityNotice(
        SecurityNoticeType.Warning,
        '登录失败',
        `${getNoticeContentPrefix(ctx.log)}进行了一次失败的登录，请确认是否为本人操作`,
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

    const log = await createLog(ctx)
    let content = getNoticeContentPrefix(log)
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
