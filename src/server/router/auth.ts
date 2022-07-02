import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import jwt from 'jsonwebtoken'
import jwtKoa from 'koa-jwt'
import { Context, HttpError, Next } from 'koa'
import md5 from 'crypto-js/md5'

const SECRET = 'jwt demo'

const MOCK_USER = {
    USERNAME: 'user',
    PASSWORD: 'password'
}

const privateRouter = new Router<any, AppKoaContext>()

/**
 * 鉴权失败时完善响应提示信息
 */
const customAuthorizationCatcher = async (ctx: Context, next: Next) => {
    try {
        await next()
    } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
            response(ctx, { code: 401, msg: '鉴权失败' })
        } else {
            throw err
        }
    }
}

privateRouter.use(customAuthorizationCatcher)
privateRouter.use(jwtKoa({ secret: SECRET }))

// 返回用户的 token 信息
privateRouter.get('/userInfo', async ctx => {
    response(ctx, { code: 200, data: ctx.state.user })
})

const loginRouter = new Router<any, AppKoaContext>()

// 登录接口
loginRouter.post('/login', async ctx => {
    const { username, code } = ctx.request.body

    if (username !== MOCK_USER.USERNAME || md5(MOCK_USER.PASSWORD).toString().toUpperCase() !== code) {
        response(ctx, { code: 401, msg: '用户名或密码不正确' })
        return
    }

    const token = jwt.sign({ username }, SECRET)
    response(ctx, { code: 200, data: { token } })
})

export { loginRouter, privateRouter }