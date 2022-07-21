import qs from 'qs'
import { history } from '../route'
import { AppResponse } from '@/types/global'

// 后端地址
const baseURL = 'api/'

let token: undefined | string

/**
 * 设置请求中携带的用户 token
 */
export const setToken = (newToken: string | undefined) => {
    token = newToken
}

/**
 * 基础请求器
 *
 * @param url 请求 url
 * @param requestInit 请求初始化配置
 */
const fetcher = async <T = Response>(url: string, requestInit: RequestInit = {}): Promise<T> => {
    console.log('url', url)
    const init = {
        ...requestInit,
        headers: { ...requestInit.headers },
    }
    if (token) (init.headers as any).Authorization = `Bearer ${token}`

    const pureUrl = url.startsWith('/') ? url.substring(1) : url
    const resp = await fetch(baseURL + pureUrl, init)

    if (resp.status === 401) {
        history.push('/login', { replace: true })
    }

    return resp.json()
}

/**
 * 使用 GET 发起请求
 *
 * @param url 请求路由
 * @param query 请求的参数，会拼接到 url 后面
 */
export const sendGet = async function <T>(url: string, query = {}) {
    const requestUrl = url + qs.stringify(query, { addQueryPrefix: true })
    const config: RequestInit = { method: 'GET' }

    return fetcher<AppResponse<T>>(requestUrl, config)
}

/**
 * 使用 POST 发起请求
 *
 * @param url 请求路由
 * @param body 请求参数，会放在 body 里
 */
export const sendPost = async function <T>(url: string, body = {}) {
    const config: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }

    return fetcher<AppResponse<T>>(url, config)
}

/**
 * 使用 PUT 发起请求
 *
 * @param url 请求路由
 * @param body 请求参数，会放在 body 里
 */
export const sendPut = async function <T>(url: string, body = {}) {
    const config: RequestInit = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }

    return fetcher<AppResponse<T>>(url, config)
}

/**
 * 使用 DELETE 发起请求
 *
 * @param url 请求路由
 * @param body 请求参数，会放在 body 里
 */
export const sendDelete = async function <T>(url: string, body = {}) {
    const config: RequestInit = {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }

    return fetcher<AppResponse<T>>(url, config)
}
