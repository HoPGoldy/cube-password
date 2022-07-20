import Router from 'koa-router'
import { loginRouter } from './auth'
import { globalRouter } from './app'
import { groupRouter } from './certificateGroup'
import { AppKoaContext } from '@/types/global'
import { middlewareJwt, middlewareJwtCatcher } from '../lib/auth'

const routes = [globalRouter, loginRouter, groupRouter]
const publicPath = ['/api/global', '/api/requireLogin', '/api/login', '/api/register']

const apiRouter = new Router<unknown, AppKoaContext>()
apiRouter.use(middlewareJwtCatcher)
apiRouter.use(middlewareJwt.unless({ path: publicPath }))

routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

export default apiRouter