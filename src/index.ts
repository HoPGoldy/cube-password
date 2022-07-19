import Koa from 'koa'
import router from './server/router'
import historyApiFallback from 'koa2-connect-history-api-fallback'
import logger from 'koa-logger'
import bodyParser from 'koa-body'
import { serveStatic } from './server/lib/static'

const START_PORT = process.env.PORT || 3600

const app = new Koa()

app.use(logger())
    .use(bodyParser({ multipart: true }))
    .use(router.routes())
    .use(router.allowedMethods())
    .use(serveStatic)
    .use(historyApiFallback({ whiteList: ['/api'] }))
    .listen(START_PORT, () => {
        console.log(`server is running at http://localhost:${START_PORT}`)
    })