import { sendGet, sendPost } from './base'
import { AppConfig } from '@/types/appConfig'
import { nanoid } from 'nanoid'
import { sha } from '@/utils/common'
import { RequireLoginResp } from '@/types/http'

export const requireLogin = async () => {
    return sendPost<RequireLoginResp>('/requireLogin')
}

/** 登录 */
export const login = async (password: string, salt: string, challenge: string) => {
    return sendPost<{ token: string }>('/login', {
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
