import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response, validate } from '@/server/utils'
import { SetAliasFunc } from '@/server/lib/routeAlias'
import { CertificateService } from './service'
import { Random } from 'mockjs'
import Joi from 'joi'
import { CertificateDetail } from '@/types/app'
import { CertificateMoveReqBody } from '@/types/http'

interface Props {
    service: CertificateService
    setAlias: SetAliasFunc
}

export const createRouter = (props: Props) => {
    const { service, setAlias } = props
    const router = new Router<any, AppKoaContext>()

    router.get(setAlias('/certificate/:certificateId', '查询凭证详情'), async ctx => {
        const certificateId = +ctx.params.certificateId
        const resp = await service.getCertificateDetail(certificateId, ctx.state.user)
        response(ctx, resp)
    })

    /**
     * 获取一个随机英文名
     */
    router.get(setAlias('/randName', '获取随机英文名'), async ctx => {
        const data = Random.name(true).replaceAll(' ', '')
        response(ctx, { code: 200, data })
    })

    const deleteCertificateSchema = Joi.object<{ ids: number[] }>({
        ids: Joi.array().items(Joi.number()).required()
    })

    router.put(setAlias('/certificate/delete', '删除凭证', 'PUT'), async ctx => {
        const body = validate(ctx, deleteCertificateSchema)
        if (!body) return

        const resp = await service.deleteCertificate(body.ids, ctx.state.user)
        response(ctx, resp)
    })

    const moveCertificateSchema = Joi.object<CertificateMoveReqBody>({
        ids: Joi.array().items(Joi.number()).required(),
        newGroupId: Joi.number().required()
    })

    router.put(setAlias('/certificate/move', '凭证移动分组', 'PUT'), async ctx => {
        const body = validate(ctx, moveCertificateSchema)
        if (!body) return

        const resp = await service.moveCertificate(body.ids, body.newGroupId, ctx.state.user)
        response(ctx, resp)
    })

    const addCertificateSchema = Joi.object<CertificateDetail>({
        name: Joi.string().required(),
        groupId: Joi.number().required(),
        markColor: Joi.string().allow(''),
        content: Joi.string().required()
    })

    router.post(setAlias('/certificate', '添加新凭证', 'POST'), async ctx => {
        const body = validate(ctx, addCertificateSchema)
        if (!body) return

        const resp = await service.addCertificate(body, ctx.state.user)
        response(ctx, resp)
    })

    const updateCertificateSortSchema = Joi.object<{ groupIds: number[] }>({
        groupIds: Joi.array().items(Joi.number()).required()
    })

    router.put(setAlias('/updateCertificateSort', '更新分组排序', 'PUT'), async ctx => {
        const body = validate(ctx, updateCertificateSortSchema)
        if (!body) return
    
        const resp = await service.updateSort(body.groupIds)
        response(ctx, resp)
    })

    const updateCertificateSchema = Joi.object<Partial<CertificateDetail>>({
        name: Joi.string(),
        groupId: Joi.number(),
        markColor: Joi.string().allow(''),
        content: Joi.string()
    })

    router.put(setAlias('/certificate/:certificateId', '更新凭证详情', 'PUT'), async ctx => {
        const { certificateId } = ctx.params
        const body = validate(ctx, updateCertificateSchema)
        if (!body) return

        const resp = await service.updateCertificate(+certificateId, body, ctx.state.user)
        response(ctx, resp)
    })

    return router
}