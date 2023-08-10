import { Next } from 'koa'
import { nanoid } from 'nanoid'
import { response } from '../utils'
import { AppKoaContext, MyJwtPayload } from '@/types/global'
import { getReplayAttackData, validateReplayAttackData } from '@/utils/crypto'
import { STATUS_CODE } from '@/config'
import dayjs from 'dayjs'

/**
 * 通过 ctx 获取用户登录的 jwt 载荷
 * 
 * @param ctx 要获取信息的上下文
 * @param block 获取不到时是否添加响应
 */
export const getJwtPayload = (ctx: AppKoaContext, block = true) => {
    const userPayload = ctx.state?.user
    if (!userPayload?.userId && block) {
        response(ctx, { code: 400, msg: '未知用户，请重新登录' })
        return
    }

    return userPayload as MyJwtPayload
}

/**
 * 一次性令牌管理器
 * @param timeout 令牌过期时间
 */
export const createOTP = (timeout: number = 1000 * 60) => {
    const challengeCodes: Record<string | number, string | undefined> = {}

    /**
     * 弹出暂存的挑战码
     * 弹出后需要调用 create 才能使用新的挑战码
     */
    const pop = (key: string | number = 'default') => {
        const code = challengeCodes[key]
        delete challengeCodes[key]
        return code
    }

    /**
     * 生成新的挑战码
     * 会在指定时间后清空
     */
    const create = (key: string | number = 'default', value?: string) => {
        const newCode = value || nanoid()
        challengeCodes[key] = newCode

        setTimeout(() => {
            delete challengeCodes[key]
        }, timeout)

        return newCode
    }

    return { pop, create }
}

export type CreateOtpFunc = typeof createOTP

interface UserSession {
    /** 用户登录 token，该值不存在时代表用户未登录 */
    token?: string;
    /** 防重放攻击密钥 */
    replayAttackSecret?: string;
    /** 已经解锁的分组 id */
    unlockedGroupIds: Set<number>;
}

interface CreateSessionProps {
    /** 登录超时时间，默认 30 分钟 */
    timeout?: number
    /** 不需要登录就可以访问的接口 */
    excludePath?: string[]
}

/**
 * SESSION 管理器
 * 用于维护用户的登录状态
 */
export const createSession = (props: CreateSessionProps) => {
    const { timeout = 1000 * 60 * 30, excludePath = [] } = props

    /**
     * 用户登录会话信息
     * 用户在登录后保持的状态最终都保存在这个对象里
     */
    const userInfo: UserSession = {
        unlockedGroupIds: new Set(),
    }

    /**
     * 防重放攻击的随机数缓存
     */
    const nonceCache = new Map<string, number>()

    /** 添加防重放随机数到缓存 */
    const addNonceToCache = (nonce: string) => {
        nonceCache.set(nonce, Date.now())
    }

    /** 检查随机数是否过期 */
    const isNonceTimeout = (createTime: number, nowTime: number) => {
        return nowTime - createTime > 60 * 1000
    }

    // 每十分钟清理一次 nonce 缓存
    setInterval(() => {
        const now = Date.now()
        nonceCache.forEach((time, nonce) => {
            if (isNonceTimeout(time, now)) nonceCache.delete(nonce)
        })
    }, 10 * 60 * 1000)

    /** 终止会话 */
    const stop = () => {
        userInfo.token = undefined
        userInfo.replayAttackSecret = undefined
        userInfo.unlockedGroupIds.clear()
        nonceCache.clear()
    }

    /** 终止会话的计时器 */
    let stopTimer: NodeJS.Timeout | undefined

    /** 启动会话 */
    const start = () => {
        userInfo.token = nanoid()
        userInfo.replayAttackSecret = nanoid()
        console.log('登录成功', userInfo.token, dayjs().format('YYYY-MM-DD HH:mm:ss'))

        clearTimeout(stopTimer)
        stopTimer = setTimeout(() => {
            console.log('清除登录状态', userInfo.token, dayjs().format('YYYY-MM-DD HH:mm:ss'))
            stop()
        }, timeout)

        return { token: userInfo.token, replayAttackSecret: userInfo.replayAttackSecret }
    }

    /** 查询指定分组是否解锁 */
    const isGroupUnlocked = (groupId: number) => {
        return userInfo.unlockedGroupIds.has(groupId)
    }

    /** 添加解锁分组 */
    const addUnlockedGroup = (groupId: number) => {
        if (isGroupUnlocked(groupId) || !userInfo.token) return
        userInfo.unlockedGroupIds.add(groupId)
    }

    const createLoginFailResp = (ctx: AppKoaContext) => {
        response(ctx, { code: 401, msg: '登录已失效，请重新登录' })
    }

    /** 登录鉴权中间件 */
    const checkLogin = async (ctx: AppKoaContext, next: Next) => {
        const isAccessPath = !!excludePath.find(path => ctx.url.endsWith(path) || ctx.url.startsWith(path))
        // 允许 excludePath 接口正常访问
        if (isAccessPath) return await next()

        const token = ctx.header['x-session-id']
        if (!token) return createLoginFailResp(ctx)

        if (token !== userInfo.token) {
            console.log("🚀 ~ file: auth.ts:162 ~ checkLogin ~ token:", token, userInfo.token)
            return createLoginFailResp(ctx)
        }

        return await next()
    }

    const createReplayAttackFailResp = (ctx: AppKoaContext) => {
        response(ctx, { code: STATUS_CODE.REPLAY_ATTACK, msg: '伪造请求，请求已被拦截' })
    }

    /** 防重放攻击中间件 */
    const checkReplayAttack = async (ctx: AppKoaContext, next: Next) => {
        const isAccessPath = !!excludePath.find(path => ctx.url.endsWith(path) || ctx.url.startsWith(path))
        // 允许 excludePath 接口正常访问
        if (isAccessPath) return await next()

        const replayAttackData = getReplayAttackData(ctx)
        if (!replayAttackData) {
            createReplayAttackFailResp(ctx)
            console.warn(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为未提供防重放攻击 header。`)
            return
        }

        const existNonceDate = nonceCache.get(replayAttackData.nonce)
        // 如果有重复的随机码
        if (existNonceDate && !isNonceTimeout(existNonceDate, Date.now())) {
            createReplayAttackFailResp(ctx)
            console.warn(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为重复的 nonce。`)
            return
        }

        const secret = userInfo.replayAttackSecret
        if (!secret) {
            createReplayAttackFailResp(ctx)
            console.warn(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为用户尚未登录。`)
            return
        }

        const isValidate = validateReplayAttackData(replayAttackData, secret)
        if (!isValidate) {
            createReplayAttackFailResp(ctx)
            console.warn(`伪造请求攻击，请求路径：${ctx.path}。已被拦截，原因为请求签名异常。`)
            return
        }

        addNonceToCache(replayAttackData.nonce)
        await next()
    }

    return { start, stop, checkLogin, checkReplayAttack, isGroupUnlocked, addUnlockedGroup }
}

export type SessionController = ReturnType<typeof createSession>