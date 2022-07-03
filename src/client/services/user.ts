import { sendGet, sendPost } from './base'
import { AppConfig } from '@/types/appConfig'
import sha512 from 'crypto-js/sha512'
import { nanoid } from 'nanoid'

/** 登录 */
export const login = async (password: string, salt: string) => {
    return sendPost<{ token: string }>('/login', {
        code: sha512(salt + password).toString().toUpperCase()
    })
}

/** 注册 */
export const register = async (password: string) => {
    const salt = nanoid()
    return sendPost<{ token: string }>('/register', {
        code: sha512(salt + password).toString().toUpperCase(),
        salt
    })
}

/** 获取应用全局配置 */
export const fetchAppConfig = async () => {
    return sendGet<AppConfig>('/appConfig')
}
