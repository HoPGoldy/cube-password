import { createRouter } from './router'
import { createService } from './service'
import { getCertificateCollection, saveLoki } from '@/server/lib/loki'
import { setAlias } from '@/server/lib/routeAlias'
import { getGroupLockStatus } from '@/server/utils'

export const createAuthRouter = async () => {
    const certificateCollection = await getCertificateCollection()
    const service = createService({
        saveData: saveLoki,
        certificateCollection,
        getGroupLockStatus
    })

    const router = createRouter({
        service,
        setAlias
    })

    return router
}
