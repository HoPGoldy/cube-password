import Router from 'koa-router'
import { authRouter, loginLocker } from './auth'
import { globalRouter } from './global'
import { groupRouter } from './group'
import { certificateRouter } from './certificate'
import { otpVerifyRouter } from './optVerify'
import { loggerRouter, loggerService } from './logger'
import { AppKoaContext } from '@/types/global'
import { middlewareJwt, middlewareJwtCatcher } from '../lib/auth'
import { checkIsSleepTime, createCheckReplayAttack } from '../lib/security'
import { getRandomRoutePrefix } from '../lib/randomEntry'
import { OPEN_API } from '@/config'

export const createApiRouter = async () => {
    const routePrefix = await getRandomRoutePrefix()
    const routes = [globalRouter, authRouter, certificateRouter, groupRouter, loggerRouter, otpVerifyRouter]
    const publicPath = OPEN_API.map(path => routePrefix + path)

    const apiRouter = new Router<unknown, AppKoaContext>({ prefix: routePrefix})

    apiRouter
        .use(loginLocker.createCheckLoginDisable({ excludePath: ['/global', '/logInfo'] }))
        .use(createCheckReplayAttack({ excludePath: publicPath }))
        .use(checkIsSleepTime)
        .use(loggerService.middlewareLogger)
        .use(middlewareJwtCatcher)
        .use(middlewareJwt.unless({ path: publicPath }))

    routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

    return apiRouter
}
