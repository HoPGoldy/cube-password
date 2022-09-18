import { createRouter } from './router'
import { createService } from './service'
import { getAppStorage, getCertificateCollection, getSecurityNoticeCollection, insertSecurityNotice, saveLoki, updateAppStorage } from '@/server/lib/loki'
import { setAlias } from '@/server/lib/routeAlias'
import { createOTP, createToken } from '@/server/lib/auth'
import { createLoginLock, getReplayAttackSecret } from '@/server/lib/security'
import { getCertificateGroupList } from '@/server/router/certificateGroup'
import { getNoticeInfo } from '@/server/router/logger'
import { CertificateDetail } from '@/types/app'

export const createAuthRouter = () => {
    const loginLocker = createLoginLock()

    const service = createService({
        createOTP,
        saveData: saveLoki,
        getAppStorage,
        updateAppStorage,
        loginLocker,
        insertSecurityNotice,
        createToken: createToken,
        getReplayAttackSecret,
        getCertificateGroupList,
        getUnreadNoticeCount: async () => {
            const collection = await getSecurityNoticeCollection()
            return collection.chain().find({ isRead: false }).count()
        },
        getNoticeInfo: getNoticeInfo,
        getAllCertificate: async () => {
            const collection = await getCertificateCollection()
            return collection.chain().data()
        },
        updateCertificate: async (certificates: CertificateDetail[]) => {
            const collection = await getCertificateCollection()
            collection.update(certificates)
        }
    })

    const router = createRouter({
        service,
        setAlias
    })

    return router
}
