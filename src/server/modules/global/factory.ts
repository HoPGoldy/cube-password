import { createRouter } from './router'
import { createService } from './service'
import { DEFAULT_COLOR } from '@/constants'
import { saveLoki, updateAppStorage } from '@/server/lib/loki'
import { setAlias } from '@/server/lib/routeAlias'

export const createGlobalRouter = () => {
    const service = createService({
        mainColor: DEFAULT_COLOR,
        saveStorage: saveLoki,
        updateAppStorage
    })

    const router = createRouter({
        service,
        setAlias
    })

    return router
}
