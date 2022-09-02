import { STORAGE_PATH } from '@/config'
import { SecurityNoticeType } from '@/types/app'
import { AppKoaContext } from '@/types/global'
import { ensureFileSync, readFileSync, writeFileSync } from 'fs-extra'
import { DefaultState, Middleware } from 'koa'
import { nanoid } from 'nanoid'
import { createLog } from '../router/logger'
import { getNoticeContentPrefix } from '../utils'
import { insertSecurityNotice } from './loki'

let routePrefixCache: string

/**
 * 获取随机路由前缀
 */
export const getRandomRoutePrefix = function () {
    // 使用缓存
    if (routePrefixCache !== undefined) return routePrefixCache

    // 开发环境下，不使用随机前缀
    if (process.env.NODE_ENV === 'development') {
        return routePrefixCache = ''
    }

    // 读一下本地密钥
    const filePath = STORAGE_PATH + '/randomRoutePrefix'
    ensureFileSync(filePath)
    const routePrefix = readFileSync(filePath)
    if (routePrefix.toString().length > 0) return routePrefixCache = routePrefix.toString()

    // 没有密钥，新建一个
    const newRoutePrefix = '/' + nanoid()
    writeFileSync(filePath, newRoutePrefix)
    return routePrefixCache = newRoutePrefix
}

export const randomEntry: Middleware<DefaultState, AppKoaContext> = async (ctx, next) => {
    const prefixMatched = ctx.path.startsWith(getRandomRoutePrefix())
    if (prefixMatched) {
        await next()
        return
    }

    try {
        throw new Error('randomEntry')
    }
    catch (e) {
        console.error(e)
        ctx.body = 'not found'
        ctx.status = 404
        const log = await createLog(ctx)
        insertSecurityNotice(
            SecurityNoticeType.Warning,
            '访问不存在的路径',
            `
                ${getNoticeContentPrefix(log)}访问了一次不存在的路径：${ctx.url}。正常使用不应该会产生此类请求，请确认是否曾经输入了错误的访问网址
            `
        )
    }
}
