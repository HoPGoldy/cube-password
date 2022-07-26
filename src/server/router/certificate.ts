import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import Joi from 'joi'
import { getCertificateCollection } from '../lib/loki'
import { CertificateDetail } from '@/types/app'

const certificateRouter = new Router<unknown, AppKoaContext>()

/**
 * 查询加密数据
 */
certificateRouter.get('/certificate/:certificateId', async ctx => {
    const { certificateId } = ctx.params
    const collection = await getCertificateCollection()
    const certificate = collection.get(Number(certificateId))
    response(ctx, { code: 200, data: certificate })
})

/**
 * 删除加密数据
 */
certificateRouter.delete('/certificate/:certificateId', async ctx => {
    const { certificateId } = ctx.params
    const collection = await getCertificateCollection()
    const result = collection.findAndRemove({ $loki: Number(certificateId) })
    response(ctx, { code: 200, data: result })
})

const addCertificateSchema = Joi.object<CertificateDetail>({
    name: Joi.string().required(),
    groupId: Joi.string().required(),
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
    const result = collection.insertOne(value)
    if (!result) {
        response(ctx, { code: 500, msg: '新增凭证失败' })
        return
    }

    response(ctx, { code: 200, data: { id: result.$loki } })
})

const updateCertificateSchema = Joi.object<Partial<CertificateDetail>>({
    name: Joi.string(),
    groupId: Joi.string(),
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
    const result = collection.findAndUpdate({ $loki: Number(certificateId) }, old => {
        return {
            ...old,
            ...value
        }
    })
    response(ctx, { code: 200, data: result })
})

export { certificateRouter }