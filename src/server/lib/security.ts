import { DATE_FORMATTER } from '@/config'
import { SecurityNoticeType } from '@/types/app'
import { AppKoaContext } from '@/types/global'
import dayjs from 'dayjs'
import { Next } from 'koa'
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

/**
 * 创建登录重试管理器
 * 同一天内最多失败三次，超过三次后锁定
 * 连续失败锁定两天后锁死应用后台，拒绝所有请求
 */
const createLoginLock = (excludePath: string) => {
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
        if (yesterdayFail.length < 3) return
        // 24 小时后解除锁定
        unlockTimer = setTimeout(() => {
            loginDisabled = false
            unlockTimer = undefined
        }, 1000 * 60 * 60 * 24)
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
        // 全局配置接口不会拒绝，不然就裂开了
        if (ctx.url.endsWith(excludePath)) return await next()

        try {
            if (loginDisabled) throw new Error('登录失败次数过多，请求被拒绝')
            await next()
        }
        catch (e)  {
            console.error(e)
            response(ctx, { code: 403, msg: '登录失败次数过多，请稍后再试' })
        }
    }

    return { recordLoginFail, loginLockMiddleware, getLockDetail }
}

const { recordLoginFail, loginLockMiddleware, getLockDetail } = createLoginLock('/global')
export { recordLoginFail, loginLockMiddleware, getLockDetail }

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

    let content = getNoticeContentPrefix(ctx.log)
    if (!item) content += `尝试解锁一个不存在的分组(分组 id: ${groupId})`
    else content += '进行了一次失败的登录，请确认是否为本人操作'
    content += '<br/>正常使用不应该会产生此请求，请检查是否有攻击者尝试爆破分组密码'

    insertSecurityNotice(
        SecurityNoticeType.Warning,
        '分组解锁失败',
        content
    )
}

/**
 * 检查中间件 - 是否请求了非法的路径
 */
export const checkQueryNotExist: SecurityChecker = async (ctx, next) => {
    await next()

    if (ctx.status !== 404 && (ctx.body as any)?.code !== 404) return

    insertSecurityNotice(
        SecurityNoticeType.Warning,
        '访问不存在的路径',
        `
            ${getNoticeContentPrefix(ctx.log)}访问了一次不存在的路径：
            <code>${ctx.url}</code>
            正常使用不应该会产生此类请求，请检查是否有攻击者尝试爆破路径
        `
    )
}

/**
 * 请求安全监控器
 * 会对处理的请求进行检查，如果检查不通过，则会给用户显示通知
 */
// export const createMonitor = (runInterval = 100 * 60 * 5) => {
//     const checkers: SecurityChecker[] = [
//         checkIsSleepTime,
//     ]

//     const run = async () => {
//         try {
//             console.log('security check running')

//             const collection = await getLogCollection()
//             const newLogs = collection.find({ checkStatus: LogCheckStatus.Waiting })
//             const notices = newLogs.map(log => {
//                 const newNotices = checkers.map(checker => checker(log))

//                 // 如果通过所有检查后，检查状态依旧不为失败，就代表通过了所有检查
//                 if (log.checkStatus === LogCheckStatus.Waiting) {
//                     log.checkStatus = LogCheckStatus.Pass
//                 }

//                 return newNotices
//             }).flat(2)
//             collection.update(newLogs)

//             if (notices.length > 0) {
//                 const noticeCollection = await getSecurityNoticeCollection()
//                 noticeCollection.insert(notices)
//                 saveLoki('log')
//             }

//             console.log('next security check in ', runInterval / 1000, 's')
//         }
//         catch (error) {
//             console.error('安全模块出现异常', error)
//             const selfErrorNotice: SecurityNotice = {
//                 type: SecurityNoticeType.Danger,
//                 title: '安全模块异常',
//                 content: '安全模块在检查请求时发生异常，错误日志如下：' + error,
//                 date: new Date().valueOf()
//             }
//             const noticeCollection = await getSecurityNoticeCollection()
//             noticeCollection.insert(selfErrorNotice)
//         }
//     }

//     const startLoop = () => {
//         setInterval(run, runInterval)
//     }
    
//     return { run, startLoop }
// }


// const checkIsSleepTime: SecurityChecker = (log) => {
//     if (!log.route.endsWith('/login')) return []

//     const requestHour = dayjs(log.date).hour()
//     if (0 <= requestHour && requestHour < 6) {
//         return [{
//             type: SecurityNoticeType.Info,
//             title: '来自睡觉时段的登录',
//             content: `来自 ${formatLocation(log.location)} 的 ip 地址(${log.ip}) 于 ${dayjs(log.date).format(DATE_FORMATTER)} 时进行了一次登录，请检查是否为本人操作`,
//             date: new Date().valueOf()
//         }]
//     }
//     return []
// }