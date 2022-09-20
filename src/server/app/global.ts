import { createRouter } from '../modules/global/router'
import { createService } from '../modules/global/service'
import { DEFAULT_COLOR } from '@/constants'
import { saveLoki, updateAppStorage } from '@/server/lib/loki'
import { setAlias } from './routeAlias'

export const globalService = createService({
    mainColor: DEFAULT_COLOR,
    saveStorage: saveLoki,
    updateAppStorage
})

export const globalRouter = createRouter({
    service: globalService,
    setAlias
})