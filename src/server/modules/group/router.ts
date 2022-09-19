import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response, validate } from '@/server/utils'
import { SetAliasFunc } from '@/server/lib/routeAlias'
import { GroupService } from './service'
import Joi from 'joi'
import { CertificateGroup } from '@/types/app'
import { GroupAddPasswordData, GroupRemovePasswordData } from '@/types/http'

interface Props {
    service: GroupService
    setAlias: SetAliasFunc
}

export const createRouter = (props: Props) => {
    const { service, setAlias } = props
    const router = new Router<any, AppKoaContext>()

    router.get(setAlias('/group', '查询分组列表'), async ctx => {
        const data = await service.getCertificateGroupList()
        response(ctx, { code: 200, data })
    })

    router.get(setAlias('/getCountInfo', '获取分组及凭证数量'), async ctx => {
        const resp = await service.getCountInfo()
        response(ctx, resp)
    })

    router.get(setAlias('/group/:groupId/certificates', '查询分组下属凭证'), async ctx => {
        const groupId = +ctx.params.groupId
        const lockResp = await service.getGroupLockStatus(groupId, ctx.state.user)
        if (lockResp) {
            response(ctx, { code: 200, data: [] })
            return
        }

        const certificates = await service.getCertificateList(groupId)
        response(ctx, { code: 200, data: certificates })
    })

    const addGroupSchema = Joi.object<CertificateGroup>({
        name: Joi.string().required(),
        order: Joi.number().required(),
        passwordHash: Joi.string().empty(),
        passwordSalt: Joi.string().empty(),
    }).with('passwordHash', 'passwordSalt')

    router.post(setAlias('/addGroup', '新增分组', 'POST'), async ctx => {
        const body = validate(ctx, addGroupSchema)
        if (!body) return

        const resp = await service.addGroup(body)
        response(ctx, resp)
    })

    const updateGroupSchema = Joi.object<{ name: string }>({
        name: Joi.string().required()
    })

    router.put(setAlias('/updateGroupName/:groupId', '更新分组名称', 'PUT'), async ctx => {
        const body = validate(ctx, updateGroupSchema)
        if (!body) return

        const groupId = +ctx.params.groupId
        const resp = await service.updateGroupName(groupId, body.name, ctx.state.user)
        response(ctx, resp)
    })

    const updateGroupSortSchema = Joi.object<{ groupIds: number[] }>({
        groupIds: Joi.array().items(Joi.number()).required()
    })

    router.put(setAlias('/updateGroupSort', '更新分组排序', 'PUT'), async ctx => {
        const body = validate(ctx, updateGroupSortSchema)
        if (!body) return
    
        const resp = await service.updateGroupSort(body.groupIds)
        response(ctx, resp)
    })

    const setDefaultGroupSchema = Joi.object<{ groupId: number }>({
        groupId: Joi.number().required()
    })

    router.put(setAlias('/setDefaultGroup', '设置默认分组', 'PUT'), async ctx => {
        const body = validate(ctx, setDefaultGroupSchema)
        if (!body) return
    
        const resp = await service.setDefaultGroup(body.groupId)
        response(ctx, resp)
    })

    router.delete(setAlias('/group/:groupId', '删除分组', 'DELETE'), async ctx => {
        const groupId = +ctx.params.groupId
        const resp = await service.deleteGroup(groupId, ctx.state?.user)
        response(ctx, resp)
    })

    router.post(setAlias('/group/unlock/:groupId', '分组解密', 'POST'), service.checkIsGroupUnlockSuccess, async ctx => {
        const { code } = ctx.request.body
        if (!code || typeof code !== 'string') {
            response(ctx, { code: 401, msg: '无效的分组密码凭证' })
            return
        }

        const groupId = +ctx.params.groupId
        const resp = await service.unlockGroup(groupId, code, ctx.state?.user)
        response(ctx, resp)
    })

    const addGroupPasswordSchema = Joi.object<GroupAddPasswordData>({
        hash: Joi.string().required(),
        salt: Joi.string().required(),
    })

    router.post(setAlias('/group/addPassword/:groupId', '分组设置密码', 'POST'), async ctx => {
        const body = validate(ctx, addGroupPasswordSchema)
        if (!body) return
    
        const groupId = +ctx.params.groupId
        const resp = await service.groupAddPassword(groupId, body)
        response(ctx, resp)
    })

    router.post(setAlias('/group/requireOperate/:groupId', '请求分组操作', 'POST'), async ctx => {
        const groupId = +ctx.params.groupId
        const resp = await service.requireOperate(groupId)
        response(ctx, resp)
    })

    const removeGroupPasswordSchema = Joi.object<GroupRemovePasswordData>({
        hash: Joi.string().required(),
        code: Joi.string().allow(''),
    })

    router.post(setAlias('/group/removePassword/:groupId', '分组移除密码', 'POST'), async ctx => {
        const body = validate(ctx, removeGroupPasswordSchema)
        if (!body) return
    
        const groupId = +ctx.params.groupId
        const resp = await service.removeGroupPassword(groupId, body)
        response(ctx, resp)
    })

    return router
}