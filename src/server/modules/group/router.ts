import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '@/server/utils'
import { GroupService } from './service'
import { validate } from '@/server/utils'
import Joi from 'joi'
import { CertificateGroupStorage } from '@/types/group'

interface Props {
    service: GroupService
}

export const createGroupRouter = (props: Props) => {
    const { service } = props
    const router = new Router<any, AppKoaContext>({ prefix: '/group' })

    const addGroupSchema = Joi.object<Omit<CertificateGroupStorage, 'id'>>({
        name: Joi.string().required(),
        order: Joi.number().required(),
        passwordHash: Joi.string().empty(),
        passwordSalt: Joi.string().empty(),
    }).with('passwordHash', 'passwordSalt')

    // 新增分组
    router.post('/addGroup', async ctx => {
        const body = validate(ctx, addGroupSchema)
        if (!body) return

        const resp = await service.addGroup(body)
        response(ctx, resp)
    })

    return router
}