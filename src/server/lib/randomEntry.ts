import { SecurityNoticeType } from '@/types/app'
import { AppKoaContext } from '@/types/global'
import { DefaultState, Middleware } from 'koa'
import { createFileReader, getNoticeContentPrefix } from '../utils'
import { insertSecurityNotice } from './loki'

let routePrefixCache: string

/**
 * 获取随机路由前缀
 */
export const getLocalRandomRoutePrefix = createFileReader({ fileName: 'randomRoutePrefix' })

/**
 * 获取随机路由前缀
 */
export const getRandomRoutePrefix = async () => {
    // 使用缓存
    if (routePrefixCache !== undefined) return routePrefixCache

    // 开发环境下，不使用随机前缀
    if (process.env.NODE_ENV === 'development') {
        return routePrefixCache = ''
    }

    const localRoutePrefix = await getLocalRandomRoutePrefix()
    return routePrefixCache = '/' + localRoutePrefix.replace(/[\r\n]/g, '')
}

export const randomEntry: Middleware<DefaultState, AppKoaContext> = async (ctx, next) => {
    const routePrefix = await getRandomRoutePrefix()
    const prefixMatched = ctx.path.startsWith(routePrefix)
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
        const prefix = await getNoticeContentPrefix(ctx)

        insertSecurityNotice(
            SecurityNoticeType.Warning,
            '访问不存在的路径',
            `${prefix}访问了一次不存在的路径：${ctx.url}。正常使用不应该会产生此类请求，请确认是否曾经输入了错误的访问网址`
        )
    }
}
