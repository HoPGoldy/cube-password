import Router from 'koa-router'
import { loginRouter } from './auth'
import { globalRouter } from './app'
import { groupRouter } from './certificateGroup'
import { certificateRouter } from './certificate'
import { loggerRouter, middlewareLogger } from './logger'
import { AppKoaContext } from '@/types/global'
import { middlewareJwt, middlewareJwtCatcher } from '../lib/auth'
import { checkIsSleepTime, createCheckReplayAttack, lockManager } from '../lib/security'
import { getRandomRoutePrefix } from '../lib/randomEntry'
import { OPEN_API } from '@/config'

export const createApiRouter = async () => {
    const routePrefix = await getRandomRoutePrefix()
    const routes = [globalRouter, loginRouter, certificateRouter, groupRouter, loggerRouter]
    const publicPath = OPEN_API.map(path => routePrefix + path)

    const apiRouter = new Router<unknown, AppKoaContext>({ prefix: routePrefix})

    apiRouter
        .use(lockManager.loginLockMiddleware)
        .use(createCheckReplayAttack({ excludePath: publicPath }))
        .use(checkIsSleepTime)
        .use(middlewareLogger)
        .use(middlewareJwtCatcher)
        .use(middlewareJwt.unless({ path: publicPath }))

    routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

    return apiRouter
}
