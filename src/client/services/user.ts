import { sendGet, sendPost, sendPut } from './base'
import { AppConfig } from '@/types/appConfig'
import { nanoid } from 'nanoid'
import { sha } from '@/utils/crypto'
import { CountInfoResp, LoginErrorResp, LoginResp, RegisterOTPInfo, RequireLoginResp } from '@/types/http'
import { AppTheme } from '@/types/app'

export const requireLogin = async () => {
    return sendPost<RequireLoginResp>('/requireLogin')
}

/** 登录 */
export const login = async (password: string, salt: string, challenge: string, code?: string) => {
    const data: { a: string, b?: string } = { a: sha(sha(salt + password) + challenge) }
    if (code) data.b = code

    return sendPost<LoginResp>('/login', data)
}

/** 注册 */
export const register = async (password: string) => {
    const salt = nanoid(128)
    return sendPost<{ token: string }>('/register', {
        code: sha(salt + password),
        salt
    })
}

/** 获取应用全局配置 */
export const fetchAppConfig = async () => {
    return sendGet<AppConfig>('/global')
}

/** 获取登录失败情况 */
export const fetchLoginFail = async () => {
    return sendGet<LoginErrorResp>('/logInfo')
}

/** 获取数量配置信息 */
export const fetchCountInfo = async () => {
    return sendGet<CountInfoResp>('/getCountInfo')
}

/** 设置主题颜色 */
export const setAppTheme = async (theme: AppTheme) => {
    return sendPut('/theme/' + theme)
}

/** 请求修改密码 */
export const requireChangePwd = async () => {
    return sendGet<string>('/requireChangePwd')
}

/** 修改密码 */
export const changePwd = async (data: string) => {
    return sendPut<string>('/changePwd', { data })
}

/** 获取动态验证码绑定信息 */
export const fetchOtpInfo = async () => {
    return sendPost<RegisterOTPInfo>('/getOtpInfo')
}

/** 绑定动态验证码 */
export const registerOtp = async (code: string) => {
    return sendPut('/registerOTP', { code })
}

/** 解绑动态验证码 */
export const removeOtp = async (code: string) => {
    return sendPost('/removeOTP', { code })
}

/** 设置新密码生成规则 */
export const setCreatePwdSetting = async (pwdAlphabet: string, pwdLength: number) => {
    return sendPut('/createPwdSetting', { pwdAlphabet, pwdLength })
}