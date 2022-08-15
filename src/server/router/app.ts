import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import { getAppStorage } from '../lib/loki'
import { AppConfig } from '@/types/appConfig'
import { DEFAULT_COLOR } from '@/constants'
import { setAlias } from '../lib/routeAlias'
import { getLockDetail } from '../lib/security'

const globalRouter = new Router<any, AppKoaContext>()

/**
 * 获取全局应用配置
 * 该接口不需要鉴权
 */
globalRouter.get(setAlias('/global', '获取全局配置'), async ctx => {
    const appStorage = await getAppStorage()
    const randIndex = Math.floor(Math.random() * (DEFAULT_COLOR.length))
    const buttonColor = DEFAULT_COLOR[randIndex]

    const lockDetail = getLockDetail()

    const respData: AppConfig = {
        theme: appStorage.theme,
        buttonColor,
        loginFailure: lockDetail.records,
        appLock: lockDetail.disable,
        appFullLock: lockDetail.dead
    }

    response(ctx, { code: 200, data: respData })
})

export { globalRouter }