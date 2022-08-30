import { sendGet, sendPost, sendPut } from './base'
import { AppConfig } from '@/types/appConfig'
import { nanoid } from 'nanoid'
import { sha } from '@/utils/common'
import { CountInfoResp, LoginErrorResp, LoginResp, RequireLoginResp } from '@/types/http'
import { AppTheme } from '@/types/app'

export const requireLogin = async () => {
    return sendPost<RequireLoginResp>('/requireLogin')
}

/** 登录 */
export const login = async (password: string, salt: string, challenge: string) => {
    return sendPost<LoginResp>('/login', {
        code: sha(sha(salt + password) + challenge)
    })
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
// export const changePwd = async (password: string, salt: string, content: string) => {
//     return sendPut<string>('/changePwd', {
//         code: sha(sha(salt + password) + challenge)
//     })
// }