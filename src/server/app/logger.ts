import { createRouter } from '../modules/logger/router'
import { createService } from '../modules/logger/service'
import { getAppStorage, getCertificateCollection, getGroupCollection, getLogCollection, getSecurityNoticeCollection, saveLoki } from '@/server/lib/loki'
import { getAlias, setAlias } from './routeAlias'
import { groupService } from './group'

export const loggerService = createService({
    saveData: saveLoki,
    getAppStorage,
    getLogCollection,
    getNoticeCollection: getSecurityNoticeCollection,
    getGroupCollection,
    getCertificateCollection,
    getAlias,
    getGroupLockStatus: groupService.getGroupLockStatus
})

export const loggerRouter = createRouter({
    service: loggerService,
    setAlias
})