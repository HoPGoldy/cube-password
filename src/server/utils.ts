import { AppResponse } from '@/types/global'
import Joi from 'joi'
import { Context } from 'koa'

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