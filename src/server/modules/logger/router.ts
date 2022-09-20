import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response, validate } from '@/server/utils'
import { SetAliasFunc } from '@/server/lib/routeAlias'
import { LoggerService } from './service'
import Joi from 'joi'
import { LogSearchFilter, NoticeSearchFilter, PageSearchFilter } from '@/types/http'

interface Props {
    service: LoggerService
    setAlias: SetAliasFunc
}

export const createRouter = (props: Props) => {
    const { service, setAlias } = props
    const router = new Router<any, AppKoaContext>()

    const logQuerySchema = Joi.object<LogSearchFilter>({
        pageIndex: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).default(10),
        routes: Joi.string().allow(''),
    })

    router.get('/logs', async ctx => {
        const body = validate(ctx, logQuerySchema, true)
        if (!body) return

        const resp = await service.getLogList(body)
        response(ctx, resp)
    })

    const certificateLogQuerySchema = Joi.object<PageSearchFilter>({
        pageIndex: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).default(10)
    })

    router.get('/logs/certificates', async ctx => {
        const body = validate(ctx, certificateLogQuerySchema, true)
        if (!body) return

        const resp = await service.getCertificateLogList(body, ctx.state?.user)
        response(ctx, resp)
    })

    const securityNoticeQuerySchema = Joi.object<NoticeSearchFilter>({
        pageIndex: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).default(10),
        isRead: Joi.bool()
    })

    router.get(setAlias('/notices', '查询通知数据'), async ctx => {
        const body = validate(ctx, securityNoticeQuerySchema, true)
        if (!body) return

        const resp = await service.getNoticesList(body)
        response(ctx, resp)
    })

    const noticeReadSchema = Joi.object<{ isRead: boolean }>({
        isRead: Joi.bool().required()
    })

    router.post(setAlias('/notice/:noticeId/read', '设置通知是否已读', 'POST'), async ctx => {
        const noticeId = +ctx.params.noticeId
        const body = validate(ctx, noticeReadSchema)
        if (!body) return

        const resp = await service.setNoticeStatuc(noticeId, body.isRead)
        response(ctx, resp)
    })

    router.post(setAlias('/notice/readAll', '已读全部安全通知', 'POST'), async ctx => {
        const resp = await service.readAll()
        response(ctx, resp)
    })

    return router
}