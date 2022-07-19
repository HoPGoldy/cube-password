import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '../utils'
import { getAppStorage } from '../lib/loki'
import { AppConfig } from '@/types/appConfig'

const globalRouter = new Router<any, AppKoaContext>()

/**
 * 获取全局应用配置
 * 该接口不需要鉴权
 */
globalRouter.get('/global', async ctx => {
    const appStorage = await getAppStorage()
    const respData: AppConfig = {
        theme: appStorage.theme
    }

    response(ctx, { code: 200, data: respData })
})

export { globalRouter }