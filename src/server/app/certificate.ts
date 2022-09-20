import { createRouter } from '../modules/certificate/router'
import { createService } from '../modules/certificate/service'
import { getCertificateCollection, saveLoki } from '@/server/lib/loki'
import { setAlias } from './routeAlias'
import { groupService } from './group'

export const certificateService = createService({
    saveData: saveLoki,
    getCertificateCollection,
    getGroupLockStatus: groupService.getGroupLockStatus
})

export const certificateRouter = createRouter({
    service: certificateService,
    setAlias
})