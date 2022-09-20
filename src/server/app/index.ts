import Koa from 'koa'
import { createApiRouter } from './apiRouter'
import historyApiFallback from 'koa2-connect-history-api-fallback'
import logger from 'koa-logger'
import bodyParser from 'koa-body'
import { serveStatic } from '@/server/lib/static'
import { getRandomRoutePrefix, randomEntry } from '@/server/lib/randomEntry'

interface Props {
  serverPort: number
}

export const runApp = async (props: Props) => {
    const { serverPort } = props
    const app = new Koa()

    const apiRouter = await createApiRouter()
    const routePrefix = await getRandomRoutePrefix()

    app.use(logger())
        .use(randomEntry)
        .use(bodyParser({ multipart: true }))
        .use(serveStatic)
        .use(apiRouter.routes())
        .use(apiRouter.allowedMethods())
        .use(historyApiFallback({ whiteList: ['/api'] }))
        .listen(serverPort, () => {
            console.log(`server is running at http://localhost:${serverPort}${routePrefix}/`)
        })
}