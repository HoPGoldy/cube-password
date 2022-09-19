import { getServePort } from './utils/common'
import { runApp } from './server/app'

runApp({
    serverPort: getServePort()
})