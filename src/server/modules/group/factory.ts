import { createRouter } from './router'
import { createService } from './service'
import { getAppStorage, getCertificateCollection, getGroupCollection, insertSecurityNotice, saveLoki, updateAppStorage } from '@/server/lib/loki'
import { setAlias } from '@/server/lib/routeAlias'
import { createOTP, createToken } from '@/server/lib/auth'

export const createAuthRouter = async () => {
    const certificateCollection = await getCertificateCollection()
    const groupCollection = await getGroupCollection()

    const service = createService({
        createOTP,
        saveData: saveLoki,
        certificateCollection,
        groupCollection,
        getAppStorage,
        updateAppStorage,
        createToken,
        insertSecurityNotice
    })

    const router = createRouter({
        service,
        setAlias
    })

    return router
}
