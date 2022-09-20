import { STORAGE_PATH } from '@/config'
import { HttpRequestLog } from '@/types/app'
import { AppKoaContext, AppResponse } from '@/types/global'
import { formatLocation } from '@/utils/common'
import dayjs from 'dayjs'
import { ensureFile } from 'fs-extra'
import { readFile, writeFile } from 'fs/promises'
import Joi from 'joi'
import { Context } from 'koa'
import { nanoid } from 'nanoid'
import path from 'path'
import { queryIp } from './lib/queryIp'

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
 * 验证请求参数
 *
 * @param ctx koa上下文
 * @param schema joi验证对象
 * @param validateQuery 是否验证 query，为否则验证 body
 *
 * @returns 验证通过则返回验证后的值，否则返回 undefined
 */
export const validate = <T>(ctx: Context, schema: Joi.ObjectSchema<T>, validateQuery = false) => {
    const { error, value } = schema.validate(validateQuery ? ctx.request.query : ctx.request.body)
    if (!value || error) {
        response(ctx, { code: 400, msg: '数据结构不正确' })
        return
    }
    return value
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
export const getNoticeContentPrefix = async (ctx: AppKoaContext) => {
    const ip = ctx.log ? ctx.log.ip : getIp(ctx)
    const location = ctx.log ? ctx.log.location : await queryIp(ip)

    return `来自 ${formatLocation(location)} 的 ip 地址（${ip}）`
}

interface CreateFileReaderProps {
    fileName: string
    getInitData?: () => Promise<string>
}

/**
 * 创建本地文件内容读取器
 */
export const createFileReader = (props: CreateFileReaderProps) => {
    const { fileName, getInitData = async () => nanoid() } = props
    let cache: string

    return async () => {
        // 使用缓存
        if (cache) return cache

        // 读取本地文件
        const filePath = path.join(STORAGE_PATH, fileName)
        await ensureFile(filePath)
        const content = await readFile(filePath)
        const contentStr = content.toString()
        if (contentStr.length > 0) return cache = contentStr

        // 没有内容，填充一下
        const initData = await getInitData()
        await writeFile(filePath, initData)
        return cache = initData
    }
}

/**
 * 从 ctx 生成日志对象
 */
export const createLog = async (ctx: AppKoaContext) => {
    const logDetail: HttpRequestLog = {
        ip: getIp(ctx),
        method: ctx.method,
        url: ctx.url,
        route: getRequestRoute(ctx),
        responseHttpStatus: ctx.status,
        responseStatus: (ctx.body as any)?.code,
        date: dayjs().valueOf(),
        requestParams: ctx.params,
        requestBody: ctx.request.body
    }

    logDetail.location = await queryIp(logDetail.ip)

    return logDetail
}