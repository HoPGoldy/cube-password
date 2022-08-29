import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import { getAppStorage, getCertificateCollection, getGroupCollection, saveLoki, updateAppStorage } from '../lib/loki'
import { AppConfig } from '@/types/appConfig'
import { DEFAULT_COLOR } from '@/constants'
import { setAlias } from '../lib/routeAlias'
import { CountInfoResp } from '@/types/http'
import { aes } from '@/utils/common'
import { serializeCertificate } from '@/utils/changePwd'
import { AppTheme } from '@/types/app'

const globalRouter = new Router<any, AppKoaContext>()

/**
 * 获取全局应用配置
 * 该接口不需要鉴权
 */
globalRouter.get(setAlias('/global', '获取全局配置'), async ctx => {
    const appStorage = await getAppStorage()
    const randIndex = Math.floor(Math.random() * (DEFAULT_COLOR.length))
    const buttonColor = DEFAULT_COLOR[randIndex]

    const respData: AppConfig = {
        theme: appStorage.theme,
        buttonColor
    }

    response(ctx, { code: 200, data: respData })
})

/**
 * 修改亮暗主题
 */
globalRouter.put(setAlias('/theme/:themeValue', '设置主题'), async ctx => {
    const { themeValue } = ctx.params
    if (themeValue !== AppTheme.Dark && themeValue !== AppTheme.Light) {
        response(ctx, { code: 400, msg: '主题参数错误' })
    }

    updateAppStorage({ theme: themeValue as AppTheme })
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
 * 修改密码 - 获取全量数据
 * 由于后端不会接触密码，所以会把所有的凭证加密后返回给前端
 */
globalRouter.get(setAlias('/requireChangePwd', '请求修改密码'), async ctx => {
    const { passwordSha } = await getAppStorage()
    if (!passwordSha) {
        response(ctx, { code: 500, msg: '找不到主密码' })
        return
    }

    const certificateCollection = await getCertificateCollection()
    if (certificateCollection.data.length === 0) {
        response(ctx, { code: 200, data: '' })
        return
    }

    // 把所有的凭证数据整理成字符串
    const contents = serializeCertificate(certificateCollection.data.map(item => ({
        id: (item as any).$loki,
        content: item.content
    })))

    // 用老密码 hash 加密后发送给前端
    response(ctx, { code: 200, data: aes(contents, passwordSha) })
})

/**
 * 修改密码 - 更新密码
 * 前端修改完密码后会把所有的数据重新加密后再返回给后端
 */
globalRouter.put(setAlias('/changePwd', '修改密码', 'PUT'), async ctx => {
    // 前端利用老密码 hash 解密出全量加密凭证
    // 然后用老密码解密全量凭证
    // 再用新密码加密凭证，然后用老密码的 hash 加密新的全量凭证
    // 最后把新密码 hash、salt、新的全量加密凭证发送给后端

    response(ctx, { code: 200 })
})

export { globalRouter }