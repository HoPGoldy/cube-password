import qs from 'qs'
import { history } from '../Route'
import { AppResponse } from '@/types/global'
import { Notify } from 'react-vant'
import { routePrefix } from '../constans'
import { STATUS_CODE } from '@/config'
import { createReplayAttackHeader } from '@/utils/crypto'

/**
 * 后端地址
 */
const baseURL = routePrefix + '/api'

/**
 * 请求所用的 token 值
 */
let token: string | null = null

/**
 * 获取当前正在使用的登录 token
 */
export const getToken = () => token

/**
 * 设置请求中携带的用户 token
 */
export const setToken = (newToken: string | null) => token = newToken

/**
 * 基础请求器
 *
 * @param url 请求 url
 * @param requestInit 请求初始化配置
 */
const fetcher = async <T = unknown>(url: string, requestInit: RequestInit = {}, body?: Record<string, any>): Promise<T> => {
    const bodyData = body ? JSON.stringify(body) : ''
    const init = {
        ...requestInit,
        headers: { 'Content-Type': 'application/json', ...requestInit.headers }
    }
    if (bodyData) init.body = bodyData
    if (token) (init.headers as any).Authorization = `Bearer ${token}`

    const pureUrl = url.startsWith('/') ? url : ('/' + url)
    const fullUrl = baseURL + pureUrl

    const replayAttackSecret = sessionStorage.getItem('replayAttackSecret')
    if (replayAttackSecret) {
        const fixReplayAttackHeaders = createReplayAttackHeader(fullUrl, bodyData || '{}', replayAttackSecret)
        init.headers = { ...init.headers, ...fixReplayAttackHeaders }
    }

    const resp = await fetch(fullUrl, init)

    if (resp.status === 401 && history.location.pathname !== '/login') {
        setToken(null)
    }

    const data: AppResponse<T> = await resp.json()
    if (data.code !== 200) {
        if (data.code === STATUS_CODE.NEED_CODE) {
            Notify.show({ type: 'warning', message: data.msg || '未知错误' })
        }
        else {
            Notify.show({ type: 'danger', message: data.msg || '未知错误' })
        }
        throw data
    }

    return data.data as T
}

/**
 * 使用 GET 发起请求
 *
 * @param url 请求路由
 * @param query 请求的参数，会拼接到 url 后面
 */
export const sendGet = async function <T>(url: string, query = {}) {
    const requestUrl = url + qs.stringify(query, { addQueryPrefix: true, arrayFormat: 'comma' })
    const config: RequestInit = { method: 'GET' }

    return fetcher<T>(requestUrl, config)
}

/**
 * 使用 POST 发起请求
 *
 * @param url 请求路由
 * @param body 请求参数，会放在 body 里
 */
export const sendPost = async function <T>(url: string, body = {}) {
    const config: RequestInit = { method: 'POST'}
    return fetcher<T>(url, config, body)
}

/**
 * 使用 PUT 发起请求
 *
 * @param url 请求路由
 * @param body 请求参数，会放在 body 里
 */
export const sendPut = async function <T>(url: string, body = {}) {
    const config: RequestInit = { method: 'PUT' }
    return fetcher<T>(url, config, body)
}

/**
 * 使用 DELETE 发起请求
 *
 * @param url 请求路由
 * @param body 请求参数，会放在 body 里
 */
export const sendDelete = async function <T>(url: string, body = {}) {
    const config: RequestInit = { method: 'DELETE' }
    return fetcher<T>(url, config, body)
}
