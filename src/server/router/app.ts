import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import { getAppStorage, getCertificateCollection, getGroupCollection, saveLoki, updateAppStorage } from '../lib/loki'
import { AppConfig } from '@/types/appConfig'
import { DEFAULT_COLOR } from '@/constants'
import { setAlias } from '../lib/routeAlias'
import { ChangePasswordData, CountInfoResp } from '@/types/http'
import { aes, aesDecrypt, getAesMeta, sha } from '@/utils/crypto'
import { AppTheme } from '@/types/app'
import { createChallengeManager } from '../lib/auth'
import { nanoid } from 'nanoid'

const globalRouter = new Router<any, AppKoaContext>()

const challengeManager = createChallengeManager()

/**
 * 获取全局应用配置
 * 该接口不需要鉴权
 */
globalRouter.get(setAlias('/global', '获取全局配置'), async ctx => {
    const randIndex = Math.floor(Math.random() * (DEFAULT_COLOR.length))
    const buttonColor = DEFAULT_COLOR[randIndex]

    const respData: AppConfig = { buttonColor }

    response(ctx, { code: 200, data: respData })
})

/**
 * 修改亮暗主题
 */
globalRouter.put(setAlias('/theme/:themeValue', '设置黑夜模式', 'PUT'), async ctx => {
    const { themeValue } = ctx.params
    if (themeValue !== AppTheme.Dark && themeValue !== AppTheme.Light) {
        response(ctx, { code: 400, msg: '主题参数错误' })
    }

    await updateAppStorage({ theme: themeValue as AppTheme })
    response(ctx, { code: 200 })
    saveLoki()
})

/**
 * 获取当前分组和凭证数量
 */
globalRouter.get(setAlias('/getCountInfo', '获取分组及凭证数量'), async ctx => {
    const groupCollection = await getGroupCollection()
    const certificateCollection = await getCertificateCollection()

    const data: CountInfoResp = {
        group: groupCollection.count(),
        certificate: certificateCollection.count()
    }

    response(ctx, { code: 200, data })
})

/**
 * 修改密码 - 获取挑战码
 */
globalRouter.get(setAlias('/requireChangePwd', '请求修改密码'), async ctx => {
    const data = challengeManager.create()
    response(ctx, { code: 200, data })
})

/**
 * 修改密码 - 更新密码
 * aes 加密，密钥为(sha(主密码 + 盐) + 挑战码 + jwt token)
 */
globalRouter.put(setAlias('/changePwd', '修改密码', 'PUT'), async ctx => {
    const { data } = ctx.request.body
    if (!data || typeof data !== 'string') {
        response(ctx, { code: 400, msg: '参数错误' })
        return
    }

    const { passwordSha } = await getAppStorage()
    const challengeCode = challengeManager.pop()
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

    // 重新加密所有凭证
    const collection = await getCertificateCollection()
    collection.updateWhere(() => true, oldCertificate => {
        const { content } = oldCertificate
        const data = aesDecrypt(content, oldMeta.key, oldMeta.iv)
        if (!data) return
        oldCertificate.content = aes(data, newMeta.key, newMeta.iv)
    })

    // 把主密码信息更新上去
    const passwordSalt = nanoid()
    updateAppStorage({ passwordSha: sha(passwordSalt + newPwd), passwordSalt })

    response(ctx, { code: 200 })
    saveLoki()
})

export { globalRouter }