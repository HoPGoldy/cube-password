import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { errorWapper } from '../utils'
import { buildApp } from './buildApp'
import { createGlobalRouter } from '../modules/global/router'
import { createUserRouter } from '../modules/user/router'
import { createDiaryRouter } from '../modules/diary/router'
import { createGroupRouter } from '../modules/group/router'
import { createSecurityRouter } from '../modules/security/router'

/**
 * 构建路由
 * 
 * 会根据构建完成的 app 生成可访问的完整应用路由
 */
export const buildRouter = async () => {
    const { sessionController, loginLocker, ...services } = await buildApp()

    const apiRouter = new Router<unknown, AppKoaContext>()
    apiRouter
        .use(loginLocker.checkLoginDisable)
        .use(sessionController.checkLogin)
        .use(sessionController.checkReplayAttack)

    const globalRouter = createGlobalRouter({ service: services.globalService })
    const userRouter = createUserRouter({ service: services.userService })
    const groupRouter = createGroupRouter({ service: services.groupService })
    const securityRouter = createSecurityRouter({ service: services.securityService })
    const diaryRouter = createDiaryRouter({ service: services.diaryService })
    const routes = [globalRouter, userRouter, diaryRouter, groupRouter, securityRouter]

    routes.forEach(route => apiRouter.use('/api', errorWapper, route.routes(), route.allowedMethods()))

    return apiRouter
}
