import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getRequestRoute, hasGroupLogin, response } from '../utils'
import Joi from 'joi'
import dayjs from 'dayjs'
import { getCertificateCollection, getGroupCollection, getLogCollection } from '../lib/loki'
import { CertificateQueryLog, HttpRequestLog } from '@/types/app'
import { LogListResp, LogSearchFilter } from '@/types/http'
import { Next } from 'koa'
import { queryIp } from '../lib/queryIp'
import { getIp } from '../utils'
import { getAlias } from '../lib/routeAlias'

const createLog = async (ctx: AppKoaContext) => {
    const logDetail: HttpRequestLog = {
        ip: getIp(ctx),
        method: ctx.method,
        url: ctx.url,
        route: getRequestRoute(ctx),
        responseHttpStatus: ctx.status,
        responseStatus: (ctx.body as any)?.code,
        date: dayjs().valueOf(),
        requestParams: ctx.params,
        requestBody: ctx.request.body
    }

    logDetail.location = await queryIp(logDetail.ip)

    return logDetail
}

const middlewareLogger = async (ctx: AppKoaContext, next: Next) => {
    await next()
    // 不记录查看日志的请求
    if (ctx.url.startsWith('/api/logs')) return

    const log = await createLog(ctx)
    ctx.log = log
    const collection = await getLogCollection()
    collection.insertOne(log)
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

const certificateLogQuerySchema = Joi.object<LogSearchFilter>({
    pageIndex: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).default(10)
})

loggerRouter.get('/logs/certificates', async ctx => {
    const { error, value } = certificateLogQuerySchema.validate(ctx.query)
    if (!value || error) {
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }
    const { pageIndex, pageSize } = value
    const collection = await getLogCollection()

    const queryChain = collection.chain().find({
        route: {'$contains': 'certificate/:certificateId' }
    })

    const groupCollection = await getGroupCollection()
    const certificateCollection = await getCertificateCollection()

    const targetLogs = queryChain
        .simplesort('date', { desc: true })
        .offset((pageIndex - 1) * pageSize)
        .limit(pageSize)
        .data()
        .map(item => {
            const data: Partial<CertificateQueryLog & LokiObj> = {
                ...item,
                id: item.$loki,
                name: getAlias(item.route, item.method)
            }
            delete data.meta
            delete data.$loki

            return data as CertificateQueryLog
        })

    // 追加凭证信息
    for (const log of targetLogs) {
        const certificateId = log.requestParams?.certificateId
        if (!certificateId) {
            log.removed = true
            return
        }

        const certificate = certificateCollection.get(certificateId)
        if (!certificate) {
            log.removed = true
            continue
        }
        
        const group = groupCollection.get(certificate.groupId)        
        log.groupName = group.name

        // 分组加密了且没解锁，就返回，否则添加凭证名称
        if (group.passwordSalt && group.passwordSha) {
            const isGroupUnlock = await hasGroupLogin(ctx, group.$loki)
            if (!isGroupUnlock) {
                log.groupUnencrypted = true
                continue
            }
        }
        
        log.certificateName = certificate.name
    }

    const data: LogListResp = {
        entries: targetLogs,
        total: queryChain.count()
    }

    response(ctx, { code: 200, data })
})

export { loggerRouter, middlewareLogger }