import Router from 'koa-router'
import { loginRouter } from './auth'
import { AppKoaContext } from '@/types/global'
import { middlewareJwt, middlewareJwtCatcher } from '../lib/auth'

const routes = [loginRouter]

const apiRouter = new Router<unknown, AppKoaContext>()
apiRouter.use(middlewareJwtCatcher)
apiRouter.use(middlewareJwt.unless({ path: ['/login', '/register'] }))

routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

export default apiRouter