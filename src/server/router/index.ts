import demoRouter from './demo'
import Router from 'koa-router'
import { loginRouter, privateRouter } from './auth'
import { AppKoaContext } from '@/types/global'

const routes = [demoRouter, loginRouter, privateRouter]

const apiRouter = new Router<unknown, AppKoaContext>()
routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

export default apiRouter