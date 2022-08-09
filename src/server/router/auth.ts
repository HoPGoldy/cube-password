import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import { getAppStorage, saveLoki, updateAppStorage } from '../lib/loki'
import { createChallengeCode, createToken, popChallengeCode } from '../lib/auth'
import Joi from 'joi'
import { sha } from '@/utils/common'
import { STATUS_CODE } from '@/config'
import { getCertificateGroupList } from './certificateGroup'
import { LoginResp } from '@/types/http'

const loginRouter = new Router<any, AppKoaContext>()

// 请求登录
loginRouter.post('/requireLogin', async ctx => {
    const { passwordSalt } = await getAppStorage()
    if (!passwordSalt) {
        response(ctx, { code: STATUS_CODE.NOT_REGISTER, msg: '请先注册' })
        return
    }

    const challenge = createChallengeCode('login')

    response(ctx, { code: 200, data: { salt: passwordSalt, challenge } })
})

// 登录接口
loginRouter.post('/login', async ctx => {
    const { code } = ctx.request.body

    if (!code || typeof code !== 'string') {
        response(ctx, { code: 401, msg: '无效的主密码凭证' })
        return
    }

    const challengeCode = popChallengeCode('login')
    if (!challengeCode) {
        response(ctx, { code: 401, msg: '挑战码错误' })
        return
    }

    const { passwordSha, defaultGroupId } = await getAppStorage()
    if (!passwordSha) {
        response(ctx, { code: STATUS_CODE.NOT_REGISTER, msg: '请先注册' })
        return
    }

    if (sha(passwordSha + challengeCode) !== code) {
        response(ctx, { code: 401, msg: '密码错误，请检查主密码是否正确' })
        return
    }

    const token = await createToken()
    const groups = await getCertificateGroupList()

    const data: LoginResp = {
        token,
        groups,
        defaultGroupId
    }

    response(ctx, { code: 200, data })
})

const registerSchema = Joi.object<{ code: string, salt: string }>({
    code: Joi.string().required(),
    salt: Joi.string().required()
})

loginRouter.post('/register', async ctx => {
    const { value, error } = registerSchema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 401, msg: '无效的主密码凭证' })
        return
    }
    const { code, salt } = value

    const { passwordSalt, passwordSha } = await getAppStorage()
    if (passwordSalt && passwordSha) {
        response(ctx, { code: STATUS_CODE.ALREADY_REGISTER, msg: '已经注册' })
        return
    }

    await updateAppStorage({ passwordSalt: salt, passwordSha: code })
    response(ctx, { code: 200 })
    await saveLoki()
})

export { loginRouter }