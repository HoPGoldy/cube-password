import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getRequestRoute, response } from '../utils'
import Joi from 'joi'
import dayjs from 'dayjs'
import { getLogCollection } from '../lib/loki'
import { HttpRequestLog } from '@/types/app'
import { LogListResp, LogSearchFilter } from '@/types/http'
import { Next } from 'koa'
import { queryIp } from '../lib/queryIp'
import { getIp } from '../utils'
import { getAlias } from '../lib/routeAlias'

const recordLog = async (ctx: AppKoaContext) => {
    const logDetail: HttpRequestLog = {
        ip: getIp(ctx),
        method: ctx.method,
        url: ctx.url,
        route: getRequestRoute(ctx),
        responseHttpStatus: ctx.status,
        responseStatus: (ctx.body as any)?.code,
        date: dayjs().valueOf(),
        requestParams: ctx.params,
        requestBody: ctx.request.body,
    }

    if (logDetail.ip?.startsWith('::ffff:')) {
        logDetail.location = await queryIp(logDetail.ip?.replace('::ffff:', ''))
    }

    const collection = await getLogCollection()
    collection.insertOne(logDetail)
    // console.log('logDetail', logDetail)
}

const middlewareLogger = async (ctx: AppKoaContext, next: Next) => {
    await next()
    // 不记录查看日志的请求
    if (ctx.url.startsWith('/api/logs')) return
    recordLog(ctx)
}

const loggerRouter = new Router<unknown, AppKoaContext>()

const logQuerySchema = Joi.object<LogSearchFilter>({
    pageIndex: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).default(10),
    routes: Joi.string().allow(''),
})

/**
 * 查询日志数据
 */
loggerRouter.get('/logs', async ctx => {
    const { error, value } = logQuerySchema.validate(ctx.query)
    if (!value || error) {
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }
    const { pageIndex, pageSize, routes } = value
    const collection = await getLogCollection()

    let queryChain = collection.chain()

    if (routes) {
        queryChain = queryChain.find({
            route: { '$containsAny': routes.split(',') }
        })
    }

    const targetLogs = queryChain
        .simplesort('date', { desc: true })
        .offset((pageIndex - 1) * pageSize)
        .limit(pageSize)
        .data()
        .map(item => {
            const data: Partial<HttpRequestLog & LokiObj> = {
                ...item,
                id: item.$loki,
                name: getAlias(item.route, item.method)
            }
            delete data.meta
            delete data.$loki

            return data as HttpRequestLog
        })

    const data: LogListResp = {
        entries: targetLogs,
        total: queryChain.count()
    }

    response(ctx, { code: 200, data })
})

export { loggerRouter, middlewareLogger }