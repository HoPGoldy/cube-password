import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import sha512 from 'crypto-js/sha512'
import { getAppStorage, getLoginLogCollection, updateAppStorage } from '../lib/loki'
import { createToken } from '../lib/auth'

const loginRouter = new Router<any, AppKoaContext>()

// 登录接口
loginRouter.post('/login', async ctx => {
    const { code } = ctx.request.body

    // const loginCollection = await getLoginLogCollection()

    if (!code) {
        response(ctx, { code: 401, msg: '无效的主密码凭证' })
        return
    }

    const { passwordSalt, passwordSha } = await getAppStorage()
    if (!passwordSalt || !passwordSha) {
        response(ctx, { code: 401, msg: '请先注册' })
        return
    }

    if (sha512(passwordSalt + code).toString().toUpperCase() !== passwordSha) {
        response(ctx, { code: 401, msg: '登录凭证不正确' })
        return
    }

    const token = await createToken()
    response(ctx, { code: 200, data: { token } })
})

loginRouter.post('/register', async ctx => {
    const { code, salt } = ctx.request.body

    if (!code || !salt) {
        response(ctx, { code: 401, msg: '无效的主密码凭证' })
        return
    }

    await updateAppStorage({ passwordSalt: salt, passwordSha: code })
    response(ctx, { code: 200 })
})

export { loginRouter }