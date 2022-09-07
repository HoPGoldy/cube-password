import { STORAGE_PATH } from '@/config'
import { ensureFile } from 'fs-extra'
import { readFile, writeFile } from 'fs/promises'
import { Context, Next, HttpError } from 'koa'
import jwt from 'jsonwebtoken'
import jwtKoa from 'koa-jwt'
import { nanoid } from 'nanoid'
import { response } from '../utils'

let jwtSecretCache: string

/**
 * 获取 jwt 密钥
 */
export const getJwtSecretKey = async function () {
    // 使用缓存
    if (jwtSecretCache) return jwtSecretCache

    // 读一下本地密钥
    const jwtSecretPath = STORAGE_PATH + '/jwtSecret'
    await ensureFile(jwtSecretPath)
    const secret = await readFile(jwtSecretPath)
    if (secret.toString().length > 0) return jwtSecretCache = secret.toString()

    // 没有密钥，新建一个
    const newJwtSecret = nanoid()
    await writeFile(jwtSecretPath, newJwtSecret)
    return jwtSecretCache = newJwtSecret
}

/**
 * 鉴权失败时完善响应提示信息
 */
export const middlewareJwtCatcher = async (ctx: Context, next: Next) => {
    try {
        await next()
    } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
            response(ctx, { code: 401, msg: '鉴权失败' })
        } else {
            throw err
        }
    }
}

export const verifyToken = async (token: string) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, async (header, callback) => {
            console.log('header', header)
            const secret = await getJwtSecretKey()
            callback(null, secret)
        }, (err, decoded) => {
            if (err) return reject(err)
            resolve(decoded)
        })
    })
}

/**
 * JWT 鉴权中间件
 */
export const middlewareJwt = jwtKoa({ secret: getJwtSecretKey })

/**
 * 生成新的 jwt token
 */
export const createToken = async (payload: Record<string, any> = {}) => {
    const secret = await getJwtSecretKey()
    return jwt.sign(payload, secret, { expiresIn: 1000 * 60 * 30 })
}

/**
 * 实例化挑战码管理器
 * @param timeout 挑战码过期时间
 */
export const createChallengeManager = (timeout: number = 1000 * 60) => {
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
    const create = (key: string | number = 'default') => {
        const newCode = nanoid()
        challengeCodes[key] = newCode

        setTimeout(() => {
            delete challengeCodes[key]
        }, timeout)

        return newCode
    }

    return { pop, create }
}
