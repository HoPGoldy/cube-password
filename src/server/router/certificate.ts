import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import Joi from 'joi'
import dayjs from 'dayjs'
import { getCertificateCollection, saveLoki } from '../lib/loki'
import { CertificateDetail } from '@/types/app'
import { CertificateDetailResp } from '@/types/http'
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

/**
 * 删除加密数据
 */
certificateRouter.delete('/certificate/:certificateId', async ctx => {
    const { certificateId } = ctx.params
    const collection = await getCertificateCollection()
    const result = collection.findAndRemove({ $loki: Number(certificateId) })

    response(ctx, { code: 200, data: result })
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