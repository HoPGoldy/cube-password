import Koa from 'koa'
import { createApiRouter } from './server/router'
import historyApiFallback from 'koa2-connect-history-api-fallback'
import logger from 'koa-logger'
import bodyParser from 'koa-body'
import { serveStatic } from './server/lib/static'
import { getRandomRoutePrefix, randomEntry } from './server/lib/randomEntry'
import { getServePort } from './utils/common'

const runApp = async () => {
    const START_PORT = getServePort()
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
        .listen(START_PORT, () => {
            console.log(`server is running at http://localhost:${START_PORT}${routePrefix}/`)
        })
}

runApp()