import { getStoragePath } from '../lib/fileAccessor'
import { createDb } from '../lib/sqlite'
import { getAppConfig } from '../lib/fileAccessor'
import { createGlobalService } from '../modules/global/service'
import { createLoginLock } from '../lib/LoginLocker'
import { createBanLock } from '../lib/banLocker'
import { createUserService } from '@/server/modules/user/service'

import { createOTP, createToken } from '@/server/lib/auth'
import { secretFile } from '@/server/lib/replayAttackDefense'
import { createDiaryService } from '../modules/diary/service'
import { createGroupService } from '../modules/group/service'
import { createSecurityService } from '../modules/security/service'

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

    const diaryService = createDiaryService({ db })

    const globalService = createGlobalService({
        getConfig: getAppConfig,
        createChallengeCode: otpManager.create,
        db
    })

    const loginLocker = createLoginLock({
        excludePath: ['/global', '/user/createAdmin'],
    })
    
    const banLocker = createBanLock({ db })

    const securityService = createSecurityService({
        db,
    })

    const groupService = createGroupService({
        db,
    })

    const userService = createUserService({
        loginLocker,
        createToken: createToken,
        getChallengeCode: otpManager.pop,
        addGroup: groupService.addGroup,
        queryGroupList: groupService.queryGroupList,
        insertSecurityNotice: securityService.insertSecurityNotice,
        getReplayAttackSecret: secretFile.read,
        db,
    })

    return { globalService, userService, diaryService, banLocker, loginLocker, securityService, groupService }
}