import { createRouter } from '../modules/optVerify/router'
import { createService } from '../modules/optVerify/service'
import { getAppStorage, saveLoki, updateAppStorage } from '@/server/lib/loki'
import { createOTP } from '@/server/lib/auth'
import { setAlias } from './routeAlias'

export const otpVerifyService = createService({
    createOTP,
    saveData: saveLoki,
    getAppStorage,
    updateAppStorage
})

export const otpVerifyRouter = createRouter({
    service: otpVerifyService,
    setAlias
})