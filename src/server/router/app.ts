import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import { getCertificateCollection, getGroupCollection, saveLoki, updateAppStorage } from '../lib/loki'
import { AppConfig } from '@/types/appConfig'
import { DEFAULT_COLOR } from '@/constants'
import { setAlias } from '../lib/routeAlias'
import { CountInfoResp } from '@/types/http'
import { AppTheme } from '@/types/app'

const globalRouter = new Router<any, AppKoaContext>()

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

export { globalRouter }