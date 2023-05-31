import { getStoragePath } from '../lib/fileAccessor'
import { createDb } from '../lib/sqlite'
import { getAppConfig } from '../lib/fileAccessor'
import { createGlobalService } from '../modules/global/service'
import { createLoginLock } from '../lib/LoginLocker'
import { createUserService } from '@/server/modules/user/service'

import { createOTP, createSession } from '@/server/lib/auth'
import { createGroupService } from '../modules/group/service'
import { createSecurityService } from '../modules/security/service'
import { AUTH_EXCLUDE } from '@/config'
import { createCertificateService } from '../modules/certificate/service'
import { createOtpService } from '../modules/otp/service'

/**
 * 构建应用
 *
 * 会实例化各个模块的 service
 * 并将不同模块的 service 组装到一起
 */
export const buildApp = async () => {
    const db = createDb({ dbPath: getStoragePath('cube-password.db') })

    // 挑战码十秒内过期
    const otpManager = createOTP(1000 * 10)

    const globalService = createGlobalService({
        getConfig: getAppConfig,
        createChallengeCode: otpManager.create,
        db
    })

    const sessionController = createSession({
        excludePath: AUTH_EXCLUDE
    })

    const loginLocker = createLoginLock({
        excludePath: ['/global', '/user/createAdmin'],
    })

    const securityService = createSecurityService({
        db,
    })

    const groupService = createGroupService({
        db,
    })

    const userService = createUserService({
        loginLocker,
        startSession: sessionController.start,
        stopSession: sessionController.stop,
        getChallengeCode: otpManager.pop,
        addGroup: groupService.addGroup,
        queryGroupList: groupService.queryGroupList,
        insertSecurityNotice: securityService.insertSecurityNotice,
        db,
    })

    const certificateService = createCertificateService({
        db,
        isGroupUnlocked: sessionController.isGroupUnlocked,
    })

    const otpService = createOtpService({
        db,
        getChallengeCode: otpManager.pop,
        insertSecurityNotice: securityService.insertSecurityNotice,
    })

    return { sessionController, globalService, userService, loginLocker, securityService, groupService, certificateService, otpService }
}