import { AppStorage, CertificateDetail, NoticeInfo, SecurityNoticeType } from '@/types/app'
import { CreateOtpFunc } from '@/server/lib/auth'
import { AppKoaContext, AppResponse } from '@/types/global'
import { createLog, getNoticeContentPrefix } from '@/server/utils'
import { formatLocation, isSameLocation } from '@/utils/common'
import { STATUS_CODE } from '@/config'
import { CertificateGroupDetail, ChangePasswordData, LoginErrorResp, LoginResp } from '@/types/http'
import { aes, aesDecrypt, getAesMeta, sha } from '@/utils/crypto'
import { LoginLocker } from '@/server/lib/security'
import { InsertSecurityNoticeFunc } from '@/server/lib/loki'
import { authenticator } from 'otplib'
import { nanoid } from 'nanoid'
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH } from '@/constants'

interface Props {
    createOTP: CreateOtpFunc
    saveData: () => Promise<void>
    getAppStorage: () => Promise<AppStorage>
    updateAppStorage: (data: Partial<AppStorage>) => Promise<void>
    loginLocker: LoginLocker
    insertSecurityNotice: InsertSecurityNoticeFunc
    createToken: () => Promise<string>
    getReplayAttackSecret: () => Promise<string>
    getCertificateGroupList: () => Promise<CertificateGroupDetail[]>
    getUnreadNoticeCount: () => Promise<number>
    getNoticeInfo: () => Promise<NoticeInfo>
    getAllCertificate: () => Promise<CertificateDetail[]>
    updateCertificate: (certificates: CertificateDetail[]) => Promise<void>
}

export const createService = (props: Props) => {
    const {
        createOTP, getAppStorage, updateAppStorage, saveData, insertSecurityNotice,
        loginLocker, createToken,
        getCertificateGroupList, getUnreadNoticeCount, getReplayAttackSecret, getNoticeInfo,
        getAllCertificate, updateCertificate
    } = props

    const challengeManager = createOTP()

    /**
     * 请求登录
     */
    const requireLogin = async (): Promise<AppResponse> => {
        const { passwordSalt: salt } = await getAppStorage()
        if (!salt) return { code: STATUS_CODE.NOT_REGISTER, msg: '请先注册' }

        const challenge = challengeManager.create()
        return { code: 200, data: { salt, challenge } }
    }

    /**
     * 登录
     */
    const login = async (password: string, ctx: AppKoaContext, code?: string): Promise<AppResponse> => {
        const log = await createLog(ctx)

        const challengeCode = challengeManager.pop()
        if (!challengeCode) {
            const prefix = await getNoticeContentPrefix(ctx)
            insertSecurityNotice(
                SecurityNoticeType.Danger,
                '未授权状态下进行登录操作',
                `${prefix}发起了一次非法登录，已被拦截。请求 query为：${ctx.request.query.toString()}，请求 body 为：${ctx.request.body.toString()}。`
            )
            loginLocker.recordLoginFail()
            return { code: 401, msg: '挑战码错误' }
        }

        const {
            passwordHash, defaultGroupId, theme, commonLocation, totpSecret,
            createPwdAlphabet = DEFAULT_PASSWORD_ALPHABET, createPwdLength = DEFAULT_PASSWORD_LENGTH
        } = await getAppStorage()

        if (!passwordHash) {
            return { code: STATUS_CODE.NOT_REGISTER, msg: '请先注册' }
        }

        // 本次登录地点和常用登录地不同
        if (commonLocation && !isSameLocation(commonLocation, log.location)) {
        // if (true) {
            // 没有绑定动态验证码
            if (!totpSecret) {
                const beforeLocation = formatLocation(commonLocation)
                const prefix = await getNoticeContentPrefix(ctx)
                insertSecurityNotice(
                    SecurityNoticeType.Warning,
                    '异地登录',
                    `${prefix}进行了一次异地登录，上次登录地为${beforeLocation}，请检查是否为本人操作。`
                )
            }
            // 绑定了动态验证码
            else {
                if (!code) {
                    return { code: STATUS_CODE.NEED_CODE, msg: '非常用地区登录，请输入动态验证码' }
                }

                const isValid = authenticator.verify({ token: code, secret: totpSecret })
                if (!isValid) {
                    return { code: 400, msg: '动态验证码错误' }
                }

                const beforeLocation = formatLocation(commonLocation)
                const prefix = await getNoticeContentPrefix(ctx)
                insertSecurityNotice(
                    SecurityNoticeType.Info,
                    '异地登录',
                    `${prefix}进行了一次异地登录，上次登录地为${beforeLocation}，已完成动态验证码认证。请检查是否为本人操作。`
                )
            }
        }

        if (sha(passwordHash + challengeCode) !== password) {
            const prefix = await getNoticeContentPrefix(ctx)
            insertSecurityNotice(
                SecurityNoticeType.Warning,
                '登录失败',
                `${prefix}使用了错误的密码登录，请确保是本人操作。`
            )
            loginLocker.recordLoginFail()
            return { code: 401, msg: '密码错误，请检查主密码是否正确' }
        }

        const token = await createToken()
        const groups = await getCertificateGroupList()
        const unReadNoticeCount = await getUnreadNoticeCount()
        const noticeInfo =  await getNoticeInfo()
        const replayAttackSecret = await getReplayAttackSecret()

        const data: LoginResp = {
            token,
            groups,
            defaultGroupId,
            theme,
            hasNotice: unReadNoticeCount >= 1,
            replayAttackSecret,
            createPwdAlphabet,
            createPwdLength,
            ...noticeInfo
        }

        await updateAppStorage({ commonLocation: log.location })
        saveData()
        loginLocker.clearRecord()

        return { code: 200, data }
    }

    /**
     * 注册
     */
    const register = async (code: string, salt: string): Promise<AppResponse> => {
        const { passwordSalt, passwordHash } = await getAppStorage()
        if (passwordSalt && passwordHash) {
            return { code: STATUS_CODE.ALREADY_REGISTER, msg: '已经注册' }
        }

        await updateAppStorage({
            passwordSalt: salt,
            passwordHash: code,
            initTime: Date.now()
        })

        saveData()
        return { code: 200 }
    }

    /**
     * 查询登录失败接口信息
     */
    const getLogInfo = (): LoginErrorResp => {
        const lockDetail = loginLocker.getLockDetail()

        return {
            loginFailure: lockDetail.records,
            appLock: lockDetail.disable,
            appFullLock: lockDetail.dead
        }
    }

    /**
     * 修改密码 - 获取挑战码
     */
    const requireChangePwd = () => {
        return challengeManager.create('changePwd')
    }

    /**
     * 修改密码 - 更新密码
     * aes 加密，密钥为(sha(主密码 + 盐) + 挑战码 + jwt token)
     * 
     * @param changePwdData 被前端加密的修改密码信息
     */
    const changePassword = async (changePwdDataStr: string, token: string): Promise<AppResponse> => {
        const { passwordHash, totpSecret } = await getAppStorage()
        const challengeCode = challengeManager.pop('changePwd')
        if (!passwordHash || !challengeCode) {
            return { code: 400, msg: '参数错误' }
        }

        const postKey = passwordHash + challengeCode + token
        const { key, iv } = getAesMeta(postKey)
        const changeData = aesDecrypt(changePwdDataStr, key, iv)
    
        if (!changeData) return { code: 400, msg: '无效的密码修改凭证' }
    
        const { oldPwd, newPwd, code } = JSON.parse(changeData) as ChangePasswordData
        // 如果绑定了令牌，就需要进行验证
        if (totpSecret) {
            if (!code) {
                return { code: 400, msg: '请填写动态验证码' }
            }
    
            const codeConfirmed = authenticator.check(code, totpSecret)
            if (!codeConfirmed) {
                return { code: 400, msg: '验证码已过期' }
            }
        }
    
        const oldMeta = getAesMeta(oldPwd)
        const newMeta = getAesMeta(newPwd)
    
        try {
            // 重新加密所有凭证
            const allCertificates = await getAllCertificate()
            const newDatas = allCertificates.map(item => {
                const { content } = item
                const data = aesDecrypt(content, oldMeta.key, oldMeta.iv)
                if (!data) return item
    
                return {
                    ...item,
                    content: aes(data, newMeta.key, newMeta.iv)
                }
            })
    
            updateCertificate(newDatas)
    
            // 把主密码信息更新上去
            const passwordSalt = nanoid()
            await updateAppStorage({ passwordHash: sha(passwordSalt + newPwd), passwordSalt })
    
            saveData()
            loginLocker.clearRecord()
            return { code: 200 }
        }
        catch (e) {
            console.error(e)
            return { code: 500, msg: '修改密码失败' }
        }
    }

    return { requireLogin, login, register, getLogInfo, requireChangePwd, changePassword }
}

export type AuthService = ReturnType<typeof createService>