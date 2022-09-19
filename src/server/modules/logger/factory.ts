import { createRouter } from './router'
import { createService } from './service'
import { getAppStorage, getCertificateCollection, getGroupCollection, getLogCollection, getSecurityNoticeCollection, saveLoki } from '@/server/lib/loki'
import { getAlias, setAlias } from '@/server/lib/routeAlias'
import { getGroupLockStatus } from '@/server/utils'

export const createAuthRouter = async () => {
    const logCollection = await getLogCollection()
    const noticeCollection = await getSecurityNoticeCollection()
    const groupCollection = await getGroupCollection()
    const certificateCollection = await getCertificateCollection()

    const service = createService({
        saveData: saveLoki,
        getAppStorage,
        logCollection,
        noticeCollection,
        groupCollection,
        certificateCollection,
        getAlias,
        getGroupLockStatus
    })

    const router = createRouter({
        service,
        setAlias
    })

    return router
}
