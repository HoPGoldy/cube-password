import { STATUS_CODE } from '@/config'
import { HttpRequestLog } from '@/types/app'
import { AppKoaContext, AppResponse } from '@/types/global'
import { formatLocation } from '@/utils/common'
import Joi from 'joi'
import { Context } from 'koa'
import { getGroupCollection } from './lib/loki'

const initialResponse: AppResponse = {
    code: 200,
    msg: '',
    data: null
}

export const response = (ctx: Context, { code, msg, data }: AppResponse = initialResponse) => {
    if (code === 401) ctx.status = code
    ctx.body = {
        code,
        msg,
        data
    }
}

/**
 * 验证 body 参数
 */
export const validate = <T>(ctx: Context, schema: Joi.ObjectSchema<T>) => {
    const { error, value } = schema.validate(ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }
    return value
}

const groupNotLoginResp = { code: STATUS_CODE.GROUP_NOT_VERIFY_PASSWORD, msg: '分组未解密' }

/**
 * 判断指定分组是否解密过
 */
export const hasGroupLogin = async (ctx: AppKoaContext, groupId?: number, sendResp = true) => {
    if (!groupId) {
        if (sendResp) response(ctx, groupNotLoginResp)
        return false
    }

    const collection = await getGroupCollection()
    const item = collection.get(groupId)
    if (!item) {
        if (sendResp) response(ctx, groupNotLoginResp)
        return false
    }

    // 没有密码就等同于已经解密了
    const hasPassword = item.passwordSalt && item.passwordHash
    if (!hasPassword) return true

    const { user } = ctx.state || {}
    if (!user || !user.groups || !user.groups.includes(groupId)) {
        if (sendResp) response(ctx, groupNotLoginResp)
        return false
    }

    return true
}

/**
 * 获得请求发送方的 ip
 * @link https://juejin.cn/post/6844904056784175112
 * @param   {Context}  ctx
 * @return  {string}
 */
export function getIp(ctx: AppKoaContext) {
    const xRealIp = ctx.get('X-Real-Ip')
    const { ip } = ctx
    const { remoteAddress } = ctx.req.connection
    return xRealIp || ip || remoteAddress
}

/**
 * 获取请求访问的接口路由
 * 会把 params 里的值还原成对应的键名
 */
export function getRequestRoute (ctx: AppKoaContext) {
    const { url, params } = ctx
    const pureUrl = url.split('?')[0]
    if (!params) return pureUrl

    const route = Object.entries(params).reduce((prevUrl, param) => {
        const [ key, value ] = param
        return prevUrl.replace('/' + value as string, `/:${key}`)
    }, pureUrl)

    return route
}

/**
 * 生成安全通知的通用前缀
 */
export const getNoticeContentPrefix = (log?: HttpRequestLog) => {
    if (!log) {
        console.log('安全中间件找不到 log 数据')
        return '未知 ip '
    }

    const { location, ip = '未知 ip' } = log
    return `来自 ${formatLocation(location)} 的 ip 地址（${ip}）`
}