import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getIp, response } from '@/server/utils'
import { UserService } from './service'
import { validate } from '@/server/utils'
import Joi from 'joi'
import { ChangePasswordReqData, LoginReqData, RegisterReqData, SetThemeReqData } from '@/types/user'
import { getJwtPayload } from '@/server/lib/auth'

interface Props {
    service: UserService
}

export const createUserRouter = (props: Props) => {
    const { service } = props
    const router = new Router<any, AppKoaContext>({ prefix: '/user' })

    const loginSchema = Joi.object<LoginReqData>({
        a: Joi.string().required(),
        b: Joi.string().allow(null)
    })

    router.post('/login', async ctx => {
        const body = validate(ctx, loginSchema)
        if (!body) return
        const { a, b } = body

        const resp = await service.login(a, getIp(ctx) || 'anonymous', b)
        response(ctx, resp)
    })

    router.post('/logout', async ctx => {
        const resp = await service.logout()
        response(ctx, resp)
    })

    const registerSchema = Joi.object<RegisterReqData>({
        code: Joi.string().required(),
        salt: Joi.string().required()
    })

    router.post('/createAdmin', async ctx => {
        const body = validate(ctx, registerSchema)
        if (!body) return

        const resp = await service.createAdmin(body)
        response(ctx, resp)
    })

    const changePwdSchema = Joi.object<ChangePasswordReqData>({
        newP: Joi.string().required(),
        oldP: Joi.string().required()
    })

    router.post('/changePwd', async ctx => {
        const body = validate(ctx, changePwdSchema)
        if (!body) return
        const { newP, oldP } = body

        const payload = getJwtPayload(ctx)
        if (!payload) return

        const resp = await service.changePassword(payload.userId, oldP, newP)
        response(ctx, resp)
    })

    const setThemeSchema = Joi.object<SetThemeReqData>({
        theme: Joi.any().valid('light', 'dark').required()
    })

    router.post('/setTheme', async ctx => {
        const body = validate(ctx, setThemeSchema)
        if (!body) return
        const { theme } = body

        const resp = await service.setTheme(theme)
        response(ctx, resp)
    })

    // 统计文章
    router.get('/statistic', async ctx => {
        const payload = getJwtPayload(ctx)
        if (!payload) return

        const resp = await service.getDiaryCount(payload.userId)
        response(ctx, resp)
    })

    return router
}