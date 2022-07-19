import { Middleware } from 'koa'
import send from 'koa-send'
import path from 'path'
import { getAppStorage } from './loki'

export const serveStatic: Middleware = async (ctx, next) => {
    await next()

    if (ctx.method !== 'HEAD' && ctx.method !== 'GET') return
    // 请求已经被处理了
    if (ctx.body != null || ctx.status !== 404) return

    let sendPath = ctx.path
    // 如果获取的是入口页的话，就根据是否注册过返回对应的页面
    if (sendPath.endsWith('/index.html')) {
        const { passwordSalt, passwordSha } = await getAppStorage()
        sendPath = (passwordSalt && passwordSha) ? 'index.html' : 'register.html'
    }

    try {
        await send(ctx, sendPath, {
            root: path.resolve('./dist/client')
        })
    } catch (err) {
        if (err.status !== 404) {
            throw err
        }
    }
}
