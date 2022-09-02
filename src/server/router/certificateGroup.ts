import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { hasGroupLogin, response, validate } from '../utils'
import Joi from 'joi'
import { getAppStorage, getCertificateCollection, getGroupCollection, saveLoki, updateAppStorage } from '../lib/loki'
import { CertificateGroup } from '@/types/app'
import { DATE_FORMATTER, STATUS_CODE } from '@/config'
import { AddGroupResp, CertificateGroupDetail, CertificateListItem } from '@/types/http'
import { sha } from '@/utils/common'
import dayjs from 'dayjs'
import { createChallengeCode, createToken, popChallengeCode } from '../lib/auth'
import { setAlias } from '../lib/routeAlias'
import { checkIsGroupUnlockSuccess } from '../lib/security'

const groupRouter = new Router<unknown, AppKoaContext>()

/**
 * 获取分组列表
 */
export const getCertificateGroupList = async () => {
    const collection = await getGroupCollection()
    return collection.data.map<CertificateGroupDetail>(item => {
        const newItem: CertificateGroupDetail = {
            id: (item as unknown as LokiObj).$loki,
            name: item.name,
            requireLogin: !!(item.passwordSalt && item.passwordSha)
        }

        return newItem
    })
}

/**
 * 查询分组列表
 */
groupRouter.get(setAlias('/group', '查询分组列表'), async ctx => {
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
groupRouter.get(setAlias('/group/:groupId/certificates', '查询分组下属凭证'), async ctx => {
    const groupId = +ctx.params.groupId
    if (!await hasGroupLogin(ctx, groupId, false)) {
        response(ctx, { code: 200, data: [] })
        return
    }

    const certificates = await getCertificateList(groupId)
    response(ctx, { code: 200, data: certificates })
})

const addGroupSchema = Joi.object<CertificateGroup>({
    name: Joi.string().required(),
    passwordSha: Joi.string().empty(),
    passwordSalt: Joi.string().empty(),
}).with('passwordSha', 'passwordSalt')

/**
 * 新增分组
 */
groupRouter.post(setAlias('/addGroup', '新增分组', 'POST'), async ctx => {
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
groupRouter.put(setAlias('/group/:groupId', '更新分组配置', 'PUT'), async ctx => {
    const groupId = +ctx.params.groupId
    if (!await hasGroupLogin(ctx, groupId)) return

    const body = validate(ctx, updateGroupSchema)
    if (!body) return

    const collection = await getGroupCollection()
    const item = collection.get(groupId)
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
groupRouter.delete(setAlias('/group/:groupId', '删除分组', 'DELETE'), async ctx => {
    const groupId = +ctx.params.groupId
    if (!await hasGroupLogin(ctx, groupId)) return

    const certificateCollection = await getCertificateCollection()
    const includesCertificate = certificateCollection.find({ groupId })
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

/**
 * 分组解锁
 */
groupRouter.post(setAlias('/group/unlock/:groupId', '分组解密', 'POST'), checkIsGroupUnlockSuccess, async ctx => {
    const { code } = ctx.request.body
    if (!code || typeof code !== 'string') {
        response(ctx, { code: 401, msg: '无效的分组密码凭证' })
        return
    }

    const collection = await getGroupCollection()
    const groupId = Number(ctx.params.groupId)
    const item = collection.get(groupId)
    if (!item) {
        response(ctx, { code: 404, msg: '分组不存在' })
        return
    }

    const challengeCode = popChallengeCode('groupid' + groupId)
    if (!challengeCode) {
        response(ctx, { code: 200, msg: '挑战码错误' })
        return
    }

    const { passwordSha } = collection.get(groupId)
    if (!passwordSha) {
        response(ctx, { code: 200, msg: '分组不需要密码' })
        return
    }

    if (sha(passwordSha + challengeCode) !== code) {
        response(ctx, { code: STATUS_CODE.GROUP_PASSWORD_ERROR, msg: '密码错误，请检查分组密码是否正确' })
        return
    }

    // 把本分组添加到 token 里
    const { groups = [] } = ctx.state?.user || {}
    groups.push(groupId)
    const token = await createToken({ groups })
    response(ctx, { code: 200, data: { token } })
})

/**
 * 请求分组解锁
 */
groupRouter.post(setAlias('/group/requireUnlock/:groupId', '请求分组解密授权', 'POST'), async ctx => {
    const collection = await getGroupCollection()
    const groupId = Number(ctx.params.groupId)
    const groupItem = collection.get(groupId)
    if (!groupItem) {
        response(ctx, { code: 404, msg: '分组不存在' })
        return
    }
    const { passwordSha, passwordSalt } = groupItem
    if (!passwordSha || !passwordSalt) {
        response(ctx, { code: 200, msg: '分组不需要密码' })
        return
    }

    const challenge = createChallengeCode('groupid' + groupId)
    response(ctx, { code: 200, data: { salt: passwordSalt, challenge } })
})

export { groupRouter }
