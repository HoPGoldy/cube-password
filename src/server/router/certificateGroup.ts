import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response, validate } from '../utils'
import Joi from 'joi'
import { getAppStorage, getCertificateCollection, getGroupCollection, saveLoki, updateAppStorage } from '../lib/loki'
import { CertificateGroup } from '@/types/app'
import { DATE_FORMATTER, STATUS_CODE } from '@/config'
import { AddGroupResp, CertificateGroupDetail, CertificateListItem } from '@/types/http'
import { replaceLokiInfo } from '@/utils/common'
import dayjs from 'dayjs'

const groupRouter = new Router<unknown, AppKoaContext>()

/**
 * 获取分组列表
 */
export const getCertificateGroupList = async () => {
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

const getCertificateList = async (groupId: number): Promise<CertificateListItem[]> => {
    const collection = await getCertificateCollection()
    return collection.find({ groupId }).map(item => {
        return {
            id: item.$loki,
            name: item.name,
            updateTime: dayjs(item.updateTime).format(DATE_FORMATTER)
        }
    })
}

/**
 * 查询分组详情
 * 包含分组下的所有凭证头数据
 */
groupRouter.get('/group/:groupId/certificates', 
    async ctx => {
        const { groupId } = ctx.params
        const groupToken = ctx.request.header['group-token']
        if (!groupToken) {
            response(ctx, { code: STATUS_CODE.GROUP_NOT_VERIFY_PASSWORD })
            return
        }
        console.log()
    },
    async ctx => {
        const { groupId } = ctx.params
        const certificates = await getCertificateList(Number(groupId))
        response(ctx, { code: 200, data: certificates })
    }
)

const addGroupSchema = Joi.object<CertificateGroup>({
    name: Joi.string().required(),
    passwordSha: Joi.string().empty(),
    passwordSalt: Joi.string().empty(),
}).with('passwordSha', 'passwordSalt')

/**
 * 新增分组
 */
groupRouter.post('/addGroup', async ctx => {
    const body = validate(ctx, addGroupSchema)
    if (!body) return

    const collection = await getGroupCollection()
    const result = collection.insert(body)
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
    passwordSha: Joi.string(),
    passwordSalt: Joi.string(),
}).with('passwordSha', 'passwordSalt')

/**
 * 更新分组信息
 */
groupRouter.put('/group/:groupId', async ctx => {
    const { groupId } = ctx.params
    const body = validate(ctx, updateGroupSchema)
    if (!body) return

    const collection = await getGroupCollection()
    const item = collection.get(+groupId)
    if (!item) {
        response(ctx, { code: 500, msg: '分组不存在' })
        return
    }

    collection.update({ ...item, ...body })
    response(ctx, { code: 200 })
    saveLoki()
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
    if (collection.data.length <= 1) {
        response(ctx, { code: STATUS_CODE.CANT_DELETE, msg: '不能移除最后一个分组' })
        return
    }
    // 移除分组
    const needDeleteGroup = collection.get(+groupId)
    collection.remove(needDeleteGroup)

    const { defaultGroupId } = await getAppStorage()

    // 看一下是不是把默认分组移除了，是的话就更新一下
    let newDefaultId: number
    if (defaultGroupId === +groupId) {
        newDefaultId = (collection.data[0] as unknown as LokiObj).$loki
        await updateAppStorage({ defaultGroupId: newDefaultId })
    }
    else newDefaultId = defaultGroupId

    response(ctx, { code: 200, data: newDefaultId })
    saveLoki()
})

export { groupRouter }
