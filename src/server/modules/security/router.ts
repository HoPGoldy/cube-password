import Router from 'koa-router'
import { AppKoaContext } from '@/types/global'
import { getIp, response } from '@/server/utils'
import { SecurityService } from './service'
import { validate } from '@/server/utils'
import Joi from 'joi'
import { ChangePasswordReqData, LoginReqData, RegisterReqData, SetThemeReqData } from '@/types/user'
import { getJwtPayload } from '@/server/lib/auth'

interface Props {
    service: SecurityService
}

export const createUserRouter = (props: Props) => {
    const { service } = props
    const router = new Router<any, AppKoaContext>({ prefix: '/security' })

    return router
}