import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import Joi from 'joi'
import dayjs from 'dayjs'
import { getCertificateCollection, saveLoki } from '../lib/loki'
import { CertificateDetail } from '@/types/app'
import { CertificateDetailResp, CertificateMoveReqBody } from '@/types/http'
import { DATE_FORMATTER } from '@/config'

const certificateRouter = new Router<unknown, AppKoaContext>()

/**
 * 查询加密数据
 */
certificateRouter.get('/certificate/:certificateId', async ctx => {
    const { certificateId } = ctx.params
    const collection = await getCertificateCollection()
    const certificate = collection.get(Number(certificateId))

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
certificateRouter.put('/certificate/delete', async ctx => {
    const { value, error } = deleteCertificateSchema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }

    const collection = await getCertificateCollection()
    value.ids.forEach(id => collection.remove(id))

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
certificateRouter.put('/certificate/move', async ctx => {
    const { value, error } = moveCertificateSchema.validate(ctx.request.body)
    if (!value || error) {
        console.log('error', error)
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }

    const { ids, newGroupId } = value
    const collection = await getCertificateCollection()

    ids.forEach(id => {
        const item = collection.get(+id)
        if (item) collection.update({ ...item, groupId: newGroupId })
    })

    response(ctx, { code: 200 })
})

const addCertificateSchema = Joi.object<CertificateDetail>({
    name: Joi.string().required(),
    groupId: Joi.number().required(),
    content: Joi.string().required()
})

/**
 * 添加加密数据
 */
certificateRouter.post('/certificate', async ctx => {
    const { value, error } = addCertificateSchema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '凭证信息不正确' })
        return
    }

    const collection = await getCertificateCollection()
    const result = collection.insertOne({
        ...value,
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
certificateRouter.put('/certificate/:certificateId', async ctx => {
    const { certificateId } = ctx.params
    const { value, error } = updateCertificateSchema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '凭证信息不正确' })
        return
    }

    const collection = await getCertificateCollection()
    const item = collection.get(+certificateId)
    if (item) collection.update({ ...item, ...value })

    response(ctx, { code: 200 })
    saveLoki()
})

export { certificateRouter }