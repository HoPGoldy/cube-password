import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { hasGroupLogin, response, validate } from '../utils'
import Joi from 'joi'
import { getAppStorage, getCertificateCollection, getGroupCollection, saveLoki, updateAppStorage } from '../lib/loki'
import { CertificateGroup } from '@/types/app'
import { DATE_FORMATTER, STATUS_CODE } from '@/config'
import { AddGroupResp, CertificateListItem, GroupAddPasswordData } from '@/types/http'
import { sha } from '@/utils/crypto'
import dayjs from 'dayjs'
import { createToken, createOTP } from '../lib/auth'
import { setAlias } from '../lib/routeAlias'
import { checkIsGroupUnlockSuccess } from '../lib/security'

const groupRouter = new Router<unknown, AppKoaContext>()

const challengeManager = createOTP()

/**
 * 获取分组列表
 */
export const getCertificateGroupList = async () => {
    const collection = await getGroupCollection()
    return collection.chain().simplesort('order').data().map(item => {
        return {
            id: item.$loki,
            name: item.name,
            requireLogin: !!(item.passwordSalt && item.passwordHash)
        }
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
    passwordHash: Joi.string().empty(),
    passwordSalt: Joi.string().empty(),
}).with('passwordHash', 'passwordSalt')

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

const updateGroupSchema = Joi.object<{ name: string }>({
    name: Joi.string().required()
})

/**
 * 更新分组名
 */
groupRouter.put(setAlias('/updateGroupName/:groupId', '更新分组名称', 'PUT'), async ctx => {
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

    collection.update({ ...item, name: body.name })
    response(ctx, { code: 200 })
    saveLoki()
})

const updateGroupSortSchema = Joi.object<{ groupIds: number[] }>({
    groupIds: Joi.array().items(Joi.number()).required()
})

/**
 * 更新分组排序
 */
groupRouter.put(setAlias('/updateGroupSort', '更新分组排序', 'PUT'), async ctx => {
    const body = validate(ctx, updateGroupSortSchema)
    if (!body) return

    const groupOrders = body.groupIds.reduce((prev, cur, index) => {
        prev[cur] = index
        return prev
    }, {} as Record<number, number>)

    const collection = await getGroupCollection()
    const items = collection.chain().data()
    const newItems = items.map(item => {
        const newOrder = groupOrders[item.$loki]
        return { ...item, order: newOrder || 0 }
    })

    collection.update(newItems)
    response(ctx, { code: 200 })
    saveLoki()
})

const setDefaultGroupSchema = Joi.object<{ groupId: number }>({
    groupId: Joi.number().required()
})

/**
 * 设置默认分组
 */
groupRouter.put(setAlias('/setDefaultGroup', '设置默认分组', 'PUT'), async ctx => {
    const body = validate(ctx, setDefaultGroupSchema)
    if (!body) return

    await updateAppStorage({ defaultGroupId: body.groupId })
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

    const challengeCode = challengeManager.pop(groupId)
    if (!challengeCode) {
        response(ctx, { code: 200, msg: '挑战码错误' })
        return
    }

    const { passwordHash } = collection.get(groupId)
    if (!passwordHash) {
        response(ctx, { code: 200, msg: '分组不需要密码' })
        return
    }

    if (sha(passwordHash + challengeCode) !== code) {
        response(ctx, { code: STATUS_CODE.GROUP_PASSWORD_ERROR, msg: '密码错误，请检查分组密码是否正确' })
        return
    }

    // 把本分组添加到 token 里
    const { groups = [] } = ctx.state?.user || {}
    groups.push(groupId)
    const token = await createToken({ groups })
    response(ctx, { code: 200, data: { token } })
})

const addGroupPasswordSchema = Joi.object<GroupAddPasswordData>({
    hash: Joi.string().required(),
    salt: Joi.string().required(),
})

/**
 * 分组设置密码
 */
groupRouter.post(setAlias('/group/addPassword/:groupId', '分组设置密码', 'POST'), async ctx => {
    const body = validate(ctx, addGroupPasswordSchema)
    if (!body) return

    const collection = await getGroupCollection()
    const groupId = Number(ctx.params.groupId)
    const item = collection.get(groupId)
    if (!item) {
        response(ctx, { code: 404, msg: '分组不存在' })
        return
    }

    const { passwordHash } = collection.get(groupId)
    if (passwordHash) {
        response(ctx, { code: 400, msg: '分组已加密，请先移除密码' })
        return
    }

    item.passwordHash = body.hash
    item.passwordSalt = body.salt

    collection.update(item)
    response(ctx, { code: 200 })
    saveLoki()
})

/**
 * 请求分组挑战码
 */
groupRouter.post(setAlias('/group/requireOperate/:groupId', '请求分组挑战码', 'POST'), async ctx => {
    const collection = await getGroupCollection()
    const groupId = Number(ctx.params.groupId)
    const groupItem = collection.get(groupId)
    if (!groupItem) {
        response(ctx, { code: 404, msg: '分组不存在' })
        return
    }
    const { passwordHash, passwordSalt } = groupItem
    if (!passwordHash || !passwordSalt) {
        response(ctx, { code: 200, msg: '分组不需要密码' })
        return
    }

    const challenge = challengeManager.create(groupId)
    response(ctx, { code: 200, data: { salt: passwordSalt, challenge } })
})

export { groupRouter }
