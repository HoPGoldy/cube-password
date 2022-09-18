import { createRouter } from './router'
import { createService } from './service'
import { getAppStorage, saveLoki, updateAppStorage } from '@/server/lib/loki'
import { setAlias } from '@/server/lib/routeAlias'
import { createOTP } from '@/server/lib/auth'

export const createAuthRouter = () => {
    const service = createService({
        createOTP,
        saveData: saveLoki,
        getAppStorage,
        updateAppStorage
    })

    const router = createRouter({
        service,
        setAlias
    })

    return router
}
