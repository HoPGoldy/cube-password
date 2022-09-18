import { AppStorage } from '@/types/app'
import { CreateOtpFunc } from '@/server/lib/auth'
import { AppResponse } from '@/types/global'
import { RegisterOTPInfo } from '@/types/http'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

interface Props {
    createOTP: CreateOtpFunc
    saveData: () => Promise<void>
    getAppStorage: () => Promise<AppStorage>
    updateAppStorage: (data: Partial<AppStorage>) => Promise<void>
}

export const createService = (props: Props) => {
    const { createOTP, getAppStorage, updateAppStorage, saveData } = props

    // 五分钟超时
    const optSecretManager = createOTP(1000 * 60 * 5)

    /**
     * 获取 OTP 令牌信息
     * 如果未绑定令牌，则返回绑定二维码 base64
     */
    const getOtpInfo = async (): Promise<AppResponse<RegisterOTPInfo>> => {
        const { totpSecret } = await getAppStorage()
        if (totpSecret) {
            const data = { registered: true }
            return { code: 200, data }
        }

        const secret = authenticator.generateSecret()
        optSecretManager.create('default', secret)

        const qrcodeUrl = await QRCode.toDataURL(authenticator.keyuri('main password', 'keep-my-password', secret))
        const data = { registered: false, qrCode: qrcodeUrl }
        return { code: 200, data }
    }

    /**
     * 绑定 otp 令牌
     *
     * @param code 动态令牌
     */
    const registerOtp = async (code: string): Promise<AppResponse> => {
        const { totpSecret } = await getAppStorage()
        if (totpSecret) {
            return { code: 400, msg: '已绑定令牌' }
        }

        const secret = optSecretManager.pop('default')
        if (!secret) {
            return { code: 400, msg: '令牌已失效，请重新绑定' }
        }

        const codeConfirmed = authenticator.check(code, secret)
        if (!codeConfirmed) {
            return { code: 400, msg: '验证码错误，请重新绑定' }
        }

        await updateAppStorage({ totpSecret: secret })
        saveData()
        return { code: 200 }
    }

    /**
     * 解绑 otp 令牌
     *
     * @param code 动态令牌
     */
    const removeOtp = async (code: string): Promise<AppResponse> => {
        const { totpSecret } = await getAppStorage()
        if (!totpSecret) {
            return { code: 400, msg: '未绑定令牌' }
        }

        const codeConfirmed = authenticator.check(code, totpSecret)
        if (!codeConfirmed) {
            return { code: 400, msg: '验证码已过期，请重新输入' }
        }

        await updateAppStorage({ totpSecret: undefined })
        saveData()
        return { code: 200 }
    }

    return { getOtpInfo, registerOtp, removeOtp }
}

export type OptVerifyService = ReturnType<typeof createService>