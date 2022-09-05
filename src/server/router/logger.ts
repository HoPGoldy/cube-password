import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getRequestRoute, hasGroupLogin, response, validate } from '../utils'
import Joi from 'joi'
import dayjs from 'dayjs'
import { getAppStorage, getCertificateCollection, getGroupCollection, getLogCollection, getSecurityNoticeCollection, saveLoki } from '../lib/loki'
import { CertificateQueryLog, HttpRequestLog, SecurityNoticeType } from '@/types/app'
import { LogListResp, LogSearchFilter, NoticeInfoResp, NoticeListResp, NoticeSearchFilter, PageSearchFilter, SecurityNoticeResp } from '@/types/http'
import { Next } from 'koa'
import { queryIp } from '../lib/queryIp'
import { getIp } from '../utils'
import { getAlias } from '../lib/routeAlias'
import { DATE_FORMATTER } from '@/config'
import { setAlias } from '../lib/routeAlias'

/**
 * 从 ctx 生成日志对象
 */
export const createLog = async (ctx: AppKoaContext) => {
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

/**
 * 日记记录中间件
 */
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

const certificateLogQuerySchema = Joi.object<PageSearchFilter>({
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

const securityNoticeQuerySchema = Joi.object<NoticeSearchFilter>({
    pageIndex: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).default(10),
    isRead: Joi.bool()
})

/**
 * 查询通知数据
 */
loggerRouter.get(setAlias('/notices', '查询通知数据'), async ctx => {
    const { error, value } = securityNoticeQuerySchema.validate(ctx.query)
    if (!value || error) {
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }
    const { pageIndex, pageSize, isRead } = value
    const collection = await getSecurityNoticeCollection()

    let queryChain = collection.chain()
    if (isRead !== undefined) queryChain = queryChain.find({ isRead })

    // 获取最严重的通知等级
    const topLevel = queryChain.mapReduce(
        item => item.type,
        arr => Math.max(...arr)
    ) as SecurityNoticeType

    const targetLogs = queryChain
        .simplesort('date', { desc: true })
        .offset((pageIndex - 1) * pageSize)
        .limit(pageSize)
        .data()
        .map(item => {
            const data: Partial<SecurityNoticeResp & LokiObj> = {
                ...item,
                date: dayjs(item.date).format(DATE_FORMATTER),
                id: item.$loki,
            }
            delete data.meta
            delete data.$loki

            return data as SecurityNoticeResp
        })

    const { initTime } = await getAppStorage()
    const logCollection = await getLogCollection()

    const data: NoticeListResp = {
        entries: targetLogs,
        total: queryChain.count(),
        topLevel,
        totalScanReq: logCollection.count(),
        initTime: dayjs().diff(dayjs(initTime), 'day')
    }

    response(ctx, { code: 200, data })
})

const noticeReadSchema = Joi.object<{ isRead: boolean }>({
    isRead: Joi.bool().required()
})

/**
 * 更新通知的已读 / 未读状态
 */
loggerRouter.post(setAlias('/notice/:noticeId/read', '设置通知是否已读', 'POST'), async ctx => {
    const noticeId = +ctx.params.noticeId
    const body = validate(ctx, noticeReadSchema)
    if (!body) return

    const collection = await getSecurityNoticeCollection()
    const item = collection.get(noticeId)
    if (!item) {
        response(ctx, { code: 500, msg: '通知不存在' })
        return
    }

    item.isRead = body.isRead
    collection.update(item)

    const data: NoticeInfoResp = await getNoticeInfo()
    response(ctx, { code: 200, data })
    saveLoki('log')
})

/**
 * 已读所有未读通知
 */
loggerRouter.post(setAlias('/notice/readAll', '已读全部安全通知', 'POST'), async ctx => {
    const collection = await getSecurityNoticeCollection()
    collection.findAndUpdate({ isRead: false }, old => {
        old.isRead = true
    })

    const data: NoticeInfoResp = await getNoticeInfo()
    response(ctx, { code: 200, data })
    saveLoki('log')
})

export const getNoticeInfo = async () => {
    const collection = await getSecurityNoticeCollection()
    const queryChain = collection.chain().find({ isRead: false })

    const unReadNoticeTopLevel = queryChain.mapReduce(
        item => item.type,
        arr => Math.max(...arr)
    ) as SecurityNoticeType
    const unReadNoticeCount = queryChain.count()

    return { unReadNoticeTopLevel, unReadNoticeCount }
}

export { loggerRouter, middlewareLogger }