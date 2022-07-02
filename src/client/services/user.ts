import { sendGet, sendPost } from './base'
import { UserInfo } from '@/types/demo'
import md5 from 'crypto-js/md5'

/** 登录 */
export const login = async (username: string, password: string) => {
    return sendPost<UserInfo & { token: string }>('/login', {
        username,
        code: md5(password).toString().toUpperCase()
    })
}

/** 获取用户信息 */
export const fetchUserInfo = async () => {
    return sendGet<UserInfo>('/userInfo')
}
