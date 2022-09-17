import Koa from 'koa'
import router from './server/router'
import historyApiFallback from 'koa2-connect-history-api-fallback'
import logger from 'koa-logger'
import bodyParser from 'koa-body'
import { serveStatic } from './server/lib/static'
import { getRandomRoutePrefix, randomEntry } from './server/lib/randomEntry'
import { getServePort } from './utils/common'

const START_PORT = getServePort()

const app = new Koa()

app.use(logger())
    .use(randomEntry)
    .use(bodyParser({ multipart: true }))
    .use(serveStatic)
    .use(router.routes())
    .use(router.allowedMethods())
    .use(historyApiFallback({ whiteList: ['/api'] }))
    .listen(START_PORT, () => {
        console.log(`server is running at http://localhost:${START_PORT}${getRandomRoutePrefix()}/`)
    })