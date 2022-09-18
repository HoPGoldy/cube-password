import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '@/server/utils'
import { SetAliasFunc } from '@/server/lib/routeAlias'
import { AppTheme } from '@/types/app'
import { GlobalService } from './service'

interface Props {
    service: GlobalService
    setAlias: SetAliasFunc
}

export const createRouter = (props: Props) => {
    const { service, setAlias } = props
    const router = new Router<any, AppKoaContext>()

    /**
     * 获取全局应用配置
     * 该接口不需要鉴权
     */
    router.get(setAlias('/global', '获取全局配置'), async ctx => {
        response(ctx, { code: 200, data: service.getAppConfig() })
    })

    /**
     * 修改亮暗主题
     */
    router.put(setAlias('/theme/:themeValue', '设置黑夜模式', 'PUT'), async ctx => {
        const { themeValue } = ctx.params
        if (themeValue !== AppTheme.Dark && themeValue !== AppTheme.Light) {
            response(ctx, { code: 400, msg: '主题参数错误' })
        }

        await service.setTheme(themeValue as AppTheme)
        response(ctx, { code: 200 })
    })

    return router
}