import { AppResponse } from '@/types/global'
import { Context } from 'koa'

const initialResponse: AppResponse = {
    code: 200,
    msg: '',
    data: null
}

export const response = (ctx: Context, { code, msg, data }: AppResponse = initialResponse) => {
    ctx.body = {
        code,
        msg,
        data
    }
}
