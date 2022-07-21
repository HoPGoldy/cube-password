import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import Joi from 'joi'
import { getAppStorage, getCertificateCollection, getGroupCollection, saveLoki } from '../lib/loki'
import { CertificateGroup } from '@/types/app'
import { STATUS_CODE } from '@/config'
import { AddGroupResp, CertificateGroupDetail, FirstScreenResp } from '@/types/http'
import { replaceLokiInfo } from '@/utils/common'

const groupRouter = new Router<unknown, AppKoaContext>()

const getCertificateGroupList = async () => {
    const collection = await getGroupCollection()
    return collection.data.map<CertificateGroupDetail>(replaceLokiInfo)
}

/**
 * 查询分组列表
 */
groupRouter.get('/group', async ctx => {
    const data = await getCertificateGroupList()
    response(ctx, { code: 200, data })
})

const getCertificateGroupDetail = async (groupId: number) => {
    const collection = await getGroupCollection()
    return collection.get(groupId)
}

const getCertificateList = async (groupId: number) => {
    const collection = await getCertificateCollection()
    return  collection.find({ groupId })
}

/**
 * 查询分组详情
 * 包含分组下的所有凭证头数据
 */
groupRouter.get('/group/:groupId/certificates', async ctx => {
    const { groupId } = ctx.params
    const [certificates, detail] = await Promise.all([
        getCertificateList(Number(groupId)),
        getCertificateGroupDetail(Number(groupId))
    ])

    response(ctx, { code: 200, data: {
        ...detail,
        certificates
    }})
})

/**
 * 获取首屏内容
 * 包含分组列表和当前分组的详情
 */
groupRouter.get('/firstScreen', async ctx => {
    const { defaultGroupId } = await getAppStorage()
    const certificates = await getCertificateList(defaultGroupId)
    const groups = await getCertificateGroupList()

    const data: FirstScreenResp = {
        certificates,
        groups,
        defaultGroupId
    }

    response(ctx, { code: 200, data })
})

const addGroupSchema = Joi.object<CertificateGroup>({
    name: Joi.string().required(),
    remark: Joi.string().empty(),
    passwordSha: Joi.string().empty(),
    passwordSalt: Joi.string().empty(),
}).with('passwordSha', 'passwordSalt')

/**
 * 新增分组
 */
groupRouter.post('/addGroup', async ctx => {
    const { value, error } = addGroupSchema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '分组信息不正确' })
        return
    }

    const collection = await getGroupCollection()
    const result = collection.insert(value)
    if (!result) {
        response(ctx, { code: 500, msg: '新增分组失败' })
        return
    }
    const newList = await getCertificateGroupList()

    const data: AddGroupResp = {
        newList,
        newId: (result as any).$loki
    }

    response(ctx, { code: 200, data })
    saveLoki()
})

const updateGroupSchema = Joi.object<Partial<CertificateGroup>>({
    name: Joi.string(),
    remark: Joi.string(),
    passwordSha: Joi.string(),
    passwordSalt: Joi.string(),
}).with('passwordSha', 'passwordSalt')

/**
 * 更新分组信息
 */
groupRouter.put('/group/:groupId', async ctx => {
    const { groupId } = ctx.params
    const { value, error } = updateGroupSchema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '分组信息不正确' })
        return
    }

    const collection = await getGroupCollection()
    const result = collection.findAndUpdate({ $loki: Number(groupId) }, old => {
        return {
            ...old,
            ...value
        }
    })
    response(ctx, { code: 200, data: result })
})

/**
 * 删除分组
 */
groupRouter.delete('/group/:groupId', async ctx => {
    const { groupId } = ctx.params
    const certificateCollection = await getCertificateCollection()
    const includesCertificate = certificateCollection.find({ groupId: Number(groupId) })
    if (includesCertificate.length) {
        response(ctx, { code: STATUS_CODE.CANT_DELETE, msg: '分组下存在凭证，不能删除' })
        return
    }

    const collection = await getGroupCollection()
    const result = collection.findAndRemove({ $loki: Number(groupId) })
    response(ctx, { code: 200, data: result })
})

/**
 * 将分组下的所有凭证移动到其他分组
 */
groupRouter.put('/group/moveAll/', async ctx => {
    const { groupId, toGroupId } = ctx.request.body
    const collection = await getCertificateCollection()
    const result = collection.findAndUpdate({ groupId: Number(groupId) }, old => {
        return {
            ...old,
            groupId: Number(toGroupId)
        }
    })
    response(ctx, { code: 200, data: result })
})

export { groupRouter }