import Router from 'koa-router'
import { loginRouter } from './auth'
import { globalRouter } from './app'
import { groupRouter } from './certificateGroup'
import { certificateRouter } from './certificate'
import { AppKoaContext } from '@/types/global'
import { middlewareJwt, middlewareJwtCatcher } from '../lib/auth'
import { queryIp } from '../lib/queryIp'
import { getIp } from '../utils'

const routes = [globalRouter, loginRouter, certificateRouter, groupRouter]
const publicPath = ['/api/global', '/api/requireLogin', '/api/login', '/api/register']

const apiRouter = new Router<unknown, AppKoaContext>()
apiRouter.use(async (ctx, next) => {
    // const result = await queryIp('49.76.141.158')
    await next()
    // console.log(getIp(ctx), ctx.path, ctx.request.method, ctx.request.body, ctx)
})
apiRouter.use(middlewareJwtCatcher)
apiRouter.use(middlewareJwt.unless({ path: publicPath }))

routes.forEach(route => apiRouter.use('/api', route.routes(), route.allowedMethods()))

export default apiRouter