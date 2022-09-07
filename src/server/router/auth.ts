import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getNoticeContentPrefix, response } from '../utils'
import { getAppStorage, getCertificateCollection, getSecurityNoticeCollection, insertSecurityNotice, saveLoki, updateAppStorage } from '../lib/loki'
import { createChallengeManager, createToken } from '../lib/auth'
import Joi from 'joi'
import { aes, aesDecrypt, getAesMeta, sha } from '@/utils/crypto'
import { STATUS_CODE } from '@/config'
import { getCertificateGroupList } from './certificateGroup'
import { ChangePasswordData, LoginErrorResp, LoginResp } from '@/types/http'
import { setAlias } from '../lib/routeAlias'
import { lockManager } from '../lib/security'
import { SecurityNoticeType } from '@/types/app'
import { createLog, getNoticeInfo } from './logger'
import { nanoid } from 'nanoid'

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
        lockManager.recordLoginFail()
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
        lockManager.recordLoginFail()
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
        lockManager.recordLoginFail()
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
    lockManager.clearRecord()
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
    const lockDetail = lockManager.getLockDetail()

    const respData: LoginErrorResp = {
        loginFailure: lockDetail.records,
        appLock: lockDetail.disable,
        appFullLock: lockDetail.dead
    }

    response(ctx, { code: 200, data: respData })
})


/**
 * 修改密码 - 获取挑战码
 */
loginRouter.get(setAlias('/requireChangePwd', '请求修改密码'), async ctx => {
    const data = challengeManager.create('changePwd')
    response(ctx, { code: 200, data })
})

/**
 * 修改密码 - 更新密码
 * aes 加密，密钥为(sha(主密码 + 盐) + 挑战码 + jwt token)
 */
loginRouter.put(setAlias('/changePwd', '修改密码', 'PUT'), async ctx => {
    const { data } = ctx.request.body
    if (!data || typeof data !== 'string') {
        response(ctx, { code: 400, msg: '参数错误' })
        return
    }

    const { passwordSha } = await getAppStorage()
    const challengeCode = challengeManager.pop('changePwd')
    if (!passwordSha || !challengeCode) {
        response(ctx, { code: 400, msg: '参数错误' })
        return
    }

    const tokenStr = ctx.headers?.authorization
    if (!tokenStr || typeof tokenStr !== 'string') {
        response(ctx, { code: 400, msg: '未知 token，请重新登录' })
        return
    }
    const token = tokenStr.replace('Bearer ', '')
    const postKey = passwordSha + challengeCode + token
    const { key, iv } = getAesMeta(postKey)
    const changeData = aesDecrypt(data, key, iv)

    if (!changeData) {
        response(ctx, { code: 400, msg: '无效的密码修改凭证' })
        return
    }

    const { oldPwd, newPwd } = JSON.parse(changeData) as ChangePasswordData
    const oldMeta = getAesMeta(oldPwd)
    const newMeta = getAesMeta(newPwd)

    try {
        // 重新加密所有凭证
        const collection = await getCertificateCollection()
        const newDatas = collection.data.map(item => {
            const { content } = item
            const data = aesDecrypt(content, oldMeta.key, oldMeta.iv)
            if (!data) return item

            return {
                ...item,
                content: aes(data, newMeta.key, newMeta.iv)
            }
        })

        collection.update(newDatas)

        // 把主密码信息更新上去
        const passwordSalt = nanoid()
        await updateAppStorage({ passwordSha: sha(passwordSalt + newPwd), passwordSalt })

        response(ctx, { code: 200 })
        saveLoki()
        lockManager.clearRecord()
    }
    catch (e) {
        console.error(e)
        response(ctx, { code: 500, msg: '修改密码失败' })
    }
})

export { loginRouter }