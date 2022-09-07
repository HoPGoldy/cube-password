import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getNoticeContentPrefix, response } from '../utils'
import { getAppStorage, getSecurityNoticeCollection, insertSecurityNotice, saveLoki, updateAppStorage } from '../lib/loki'
import { createChallengeManager, createToken } from '../lib/auth'
import Joi from 'joi'
import { sha } from '@/utils/crypto'
import { STATUS_CODE } from '@/config'
import { getCertificateGroupList } from './certificateGroup'
import { LoginErrorResp, LoginResp } from '@/types/http'
import { setAlias } from '../lib/routeAlias'
import { getLockDetail, recordLoginFail } from '../lib/security'
import { SecurityNoticeType } from '@/types/app'
import { createLog, getNoticeInfo } from './logger'

const loginRouter = new Router<any, AppKoaContext>()

const challengeManager = createChallengeManager()

// 请求登录
loginRouter.post(setAlias('/requireLogin', '请求登录授权', 'POST'), async ctx => {
    const { passwordSalt } = await getAppStorage()
    if (!passwordSalt) {
        response(ctx, { code: STATUS_CODE.NOT_REGISTER, msg: '请先注册' })
        return
    }

    const challenge = challengeManager.create()

    response(ctx, { code: 200, data: { salt: passwordSalt, challenge } })
})

// 登录接口
loginRouter.post(setAlias('/login', '登录应用', 'POST'), async ctx => {
    const { code } = ctx.request.body

    if (!code || typeof code !== 'string') {
        response(ctx, { code: 401, msg: '无效的主密码凭证' })
        recordLoginFail()
        return
    }

    const log = await createLog(ctx)

    const challengeCode = challengeManager.pop()
    if (!challengeCode) {
        response(ctx, { code: 401, msg: '挑战码错误' })
        insertSecurityNotice(
            SecurityNoticeType.Danger,
            '未授权状态下进行登录操作',
            `${getNoticeContentPrefix(log)}发起了一次非法登录，正常使用不会导致该情况发生，判断为攻击操作。`
        )
        recordLoginFail()
        return
    }

    const { passwordSha, defaultGroupId, theme } = await getAppStorage()
    if (!passwordSha) {
        response(ctx, { code: STATUS_CODE.NOT_REGISTER, msg: '请先注册' })
        return
    }

    if (sha(passwordSha + challengeCode) !== code) {
        response(ctx, { code: 401, msg: '密码错误，请检查主密码是否正确' })
        insertSecurityNotice(
            SecurityNoticeType.Warning,
            '登录失败',
            `${getNoticeContentPrefix(log)}使用了错误的密码登录，请确保是本人操作。`
        )
        recordLoginFail()
        return
    }

    const token = await createToken()
    const groups = await getCertificateGroupList()

    const noticeCollection = await getSecurityNoticeCollection()
    const unReadNoticeCount = await noticeCollection.chain().find({ isRead: false }).count()
    const noticeInfo =  await getNoticeInfo()

    const data: LoginResp = {
        token,
        groups,
        defaultGroupId,
        theme,
        hasNotice: unReadNoticeCount >= 1,
        ...noticeInfo
    }

    response(ctx, { code: 200, data })
})

const registerSchema = Joi.object<{ code: string, salt: string }>({
    code: Joi.string().required(),
    salt: Joi.string().required()
})

loginRouter.post(setAlias('/register', '应用初始化', 'POST'), async ctx => {
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

    await updateAppStorage({
        passwordSalt: salt,
        passwordSha: code,
        initTime: Date.now()
    })
    response(ctx, { code: 200 })
    await saveLoki()
})

/**
 * 查询登录失败接口信息
 */
loginRouter.get(setAlias('/logInfo', '登录失败查询'), async ctx => {
    const lockDetail = getLockDetail()

    const respData: LoginErrorResp = {
        loginFailure: lockDetail.records,
        appLock: lockDetail.disable,
        appFullLock: lockDetail.dead
    }

    response(ctx, { code: 200, data: respData })
})

export { loginRouter }