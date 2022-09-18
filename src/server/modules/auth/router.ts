import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '@/server/utils'
import { SetAliasFunc } from '@/server/lib/routeAlias'
import { AuthService } from './service'
import Joi from 'joi'

interface Props {
    service: AuthService
    setAlias: SetAliasFunc
}

export const createRouter = (props: Props) => {
    const { service, setAlias } = props
    const router = new Router<any, AppKoaContext>()

    router.post(setAlias('/requireLogin', '请求登录授权', 'POST'), async ctx => {
        const resp = await service.requireLogin()
        response(ctx, resp)
    })

    const loginSchema = Joi.object<{ a: string, b?: string }>({
        a: Joi.string().required(),
        b: Joi.string()
    })

    router.post(setAlias('/login', '登录应用', 'POST'), async ctx => {
        const { value, error } = loginSchema.validate(ctx.request.body)
    
        if (!value || error) {
            response(ctx, { code: 401, msg: '无效的主密码凭证' })
            return
        }
        const { a: password, b: code } = value

        const resp = await service.login(password, ctx, code)
        response(ctx, resp)
    })

    const registerSchema = Joi.object<{ code: string, salt: string }>({
        code: Joi.string().required(),
        salt: Joi.string().required()
    })

    router.post(setAlias('/register', '应用初始化', 'POST'), async ctx => {
        const { value, error } = registerSchema.validate(ctx.request.body)
        if (!value || error) {
            response(ctx, { code: 401, msg: '无效的主密码凭证' })
            return
        }
        const { code, salt } = value

        const resp = await service.register(code, salt)
        response(ctx, resp)
    })

    router.get(setAlias('/logInfo', '登录失败查询'), async ctx => {
        response(ctx, { code: 200, data: service.getLogInfo() })
    })

    router.get(setAlias('/requireChangePwd', '请求修改密码'), async ctx => {
        response(ctx, { code: 200, data: service.requireChangePwd() })
    })

    router.put(setAlias('/changePwd', '修改密码', 'PUT'), async ctx => {
        const { data } = ctx.request.body
        if (!data || typeof data !== 'string') {
            response(ctx, { code: 400, msg: '参数错误' })
            return
        }

        const tokenStr = ctx.headers?.authorization
        if (!tokenStr || typeof tokenStr !== 'string') {
            response(ctx, { code: 400, msg: '未知 token，请重新登录' })
            return
        }
        const token = tokenStr.replace('Bearer ', '')

        const resp = await service.changePassword(data, token)
        response(ctx, resp)
    })

    return router
}