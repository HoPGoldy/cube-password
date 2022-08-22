import Router from 'koa-router'
import { loginRouter } from './auth'
import { globalRouter } from './app'
import { groupRouter } from './certificateGroup'
import { certificateRouter } from './certificate'
import { loggerRouter, middlewareLogger } from './logger'
import { AppKoaContext } from '@/types/global'
import { middlewareJwt, middlewareJwtCatcher } from '../lib/auth'
import { checkIsSleepTime, loginLockMiddleware } from '../lib/security'

const routes = [globalRouter, loginRouter, certificateRouter, groupRouter, loggerRouter]
const publicPath = ['/api/global', '/api/logInfo', '/api/requireLogin', '/api/login', '/api/register']

const apiRouter = new Router<unknown, AppKoaContext>()

apiRouter
    .use(loginLockMiddleware)
    .use(checkIsSleepTime)
    .use(middlewareLogger)
    .use(middlewareJwtCatcher)
    .use(middlewareJwt.unless({ path: publicPath }))

routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

export default apiRouter