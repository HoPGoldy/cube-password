import { createRouter } from '../modules/auth/router'
import { createService } from '../modules/auth/service'
import { getAppStorage, getCertificateCollection, getSecurityNoticeCollection, insertSecurityNotice, saveLoki, updateAppStorage } from '@/server/lib/loki'
import { createOTP, createToken } from '@/server/lib/auth'
import { createLoginLock, getReplayAttackSecret } from '@/server/lib/security'
import { CertificateDetail } from '@/types/app'
import { setAlias } from './routeAlias'
import { loggerService } from './logger'
import { groupService } from './group'

export const loginLocker = createLoginLock()

export const authService = createService({
    createOTP,
    saveData: saveLoki,
    getAppStorage,
    updateAppStorage,
    loginLocker,
    insertSecurityNotice,
    createToken: createToken,
    getReplayAttackSecret,
    getCertificateGroupList: groupService.getCertificateGroupList,
    getUnreadNoticeCount: async () => {
        const collection = await getSecurityNoticeCollection()
        return collection.chain().find({ isRead: false }).count()
    },
    getNoticeInfo: loggerService.getNoticeInfo,
    getAllCertificate: async () => {
        const collection = await getCertificateCollection()
        return collection.chain().data()
    },
    updateCertificate: async (certificates: CertificateDetail[]) => {
        const collection = await getCertificateCollection()
        collection.update(certificates)
    }
})

export const authRouter = createRouter({
    service: authService,
    setAlias
})