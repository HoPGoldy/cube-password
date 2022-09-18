import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { response } from '@/server/utils'
import { SetAliasFunc } from '@/server/lib/routeAlias'
import { OptVerifyService } from './service'

interface Props {
    service: OptVerifyService
    setAlias: SetAliasFunc
}

export const createRouter = (props: Props) => {
    const { service, setAlias } = props
    const router = new Router<any, AppKoaContext>()

    router.post(setAlias('/getOtpInfo', '生成谷歌令牌', 'POST'), async ctx => {
        const resp = await service.getOtpInfo()
        response(ctx, resp)
    })

    router.put(setAlias('/registerOTP', '绑定谷歌令牌', 'PUT'), async ctx => {
        const { code } = ctx.request.body
        if (!code || typeof code !== 'string') {
            response(ctx, { code: 400, msg: '参数错误' })
            return
        }

        const resp = await service.registerOtp(code)
        response(ctx, resp)
    })

    router.post(setAlias('/removeOTP', '解绑谷歌令牌', 'POST'), async ctx => {
        const { code } = ctx.request.body
        if (!code || typeof code !== 'string') {
            response(ctx, { code: 400, msg: '参数错误' })
            return
        }

        const resp = await service.removeOtp(code)
        response(ctx, resp)
    })

    return router
}