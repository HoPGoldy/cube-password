import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { hasGroupLogin, response, validate } from '../utils'
import Joi from 'joi'
import dayjs from 'dayjs'
import { getCertificateCollection, saveLoki } from '../lib/loki'
import { CertificateDetail } from '@/types/app'
import { CertificateDetailResp, CertificateMoveReqBody } from '@/types/http'
import { DATE_FORMATTER } from '@/config'
import { setAlias } from '../lib/routeAlias'

const certificateRouter = new Router<unknown, AppKoaContext>()

/**
 * 查询加密数据
 */
certificateRouter.get(setAlias('/certificate/:certificateId', '查询凭证详情'), async ctx => {
    const certificateId = +ctx.params.certificateId
    const collection = await getCertificateCollection()

    const certificate = collection.get(certificateId)
    // 找不到凭证也返回分组未解密，防止攻击者猜到哪些 id 上有信息
    if (!await hasGroupLogin(ctx, certificate?.groupId)) return

    const data: CertificateDetailResp = {
        name: certificate.name,
        content: certificate.content,
        updateTime: dayjs(certificate.updateTime).format(DATE_FORMATTER),
        createTime: dayjs(certificate.meta.created).format(DATE_FORMATTER)
    }
    response(ctx, { code: 200, data })
})

const deleteCertificateSchema = Joi.object<{ ids: number[] }>({
    ids: Joi.array().items(Joi.number()).required()
})

/**
 * 删除加密数据
 */
certificateRouter.put(setAlias('/certificate/delete', '删除凭证', 'PUT'), async ctx => {
    const body = validate(ctx, deleteCertificateSchema)
    if (!body) return

    const collection = await getCertificateCollection()
    // 先保证所有的凭证分组都登录了
    for (const certificateId of body.ids) {
        const certificate = collection.get(certificateId)
        if (!await hasGroupLogin(ctx, certificate?.groupId)) return
    }

    body.ids.forEach(id => collection.remove(id))

    response(ctx, { code: 200 })
    saveLoki()
})

const moveCertificateSchema = Joi.object<CertificateMoveReqBody>({
    ids: Joi.array().items(Joi.number()).required(),
    newGroupId: Joi.number().required()
})

/**
 * 将指定凭证移动到目标分组
 */
certificateRouter.put(setAlias('/certificate/move', '凭证移动分组', 'PUT'), async ctx => {
    const body = validate(ctx, moveCertificateSchema)
    if (!body) return

    const { ids, newGroupId } = body
    const collection = await getCertificateCollection()

    ids.forEach(id => {
        const item = collection.get(+id)
        if (item) collection.update({ ...item, groupId: newGroupId })
    })

    response(ctx, { code: 200 })
    saveLoki()
})

const addCertificateSchema = Joi.object<CertificateDetail>({
    name: Joi.string().required(),
    groupId: Joi.number().required(),
    content: Joi.string().required()
})

/**
 * 添加加密数据
 */
certificateRouter.post(setAlias('/certificate', '添加新凭证', 'POST'), async ctx => {
    const body = validate(ctx, addCertificateSchema)
    if (!body) return

    if (!await hasGroupLogin(ctx, body.groupId)) return

    const collection = await getCertificateCollection()
    const result = collection.insertOne({
        ...body,
        updateTime: new Date().valueOf()
    })
    if (!result) {
        response(ctx, { code: 500, msg: '新增凭证失败' })
        return
    }

    response(ctx, { code: 200, data: { id: result.$loki } })
    saveLoki()
})

const updateCertificateSchema = Joi.object<Partial<CertificateDetail>>({
    name: Joi.string(),
    groupId: Joi.number(),
    content: Joi.string()
})

/**
 * 修改加密数据
 */
certificateRouter.put(setAlias('/certificate/:certificateId', '更新凭证详情', 'PUT'), async ctx => {
    const { certificateId } = ctx.params
    const body = validate(ctx, updateCertificateSchema)
    if (!body) return

    const collection = await getCertificateCollection()
    const item = collection.get(+certificateId)
    if (!await hasGroupLogin(ctx, item?.groupId)) return

    if (item) collection.update({ ...item, ...body })

    response(ctx, { code: 200 })
    saveLoki()
})

export { certificateRouter }