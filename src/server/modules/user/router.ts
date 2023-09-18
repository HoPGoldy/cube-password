import Router from 'koa-router';
import { AppKoaContext } from '@/types/global';
import { getIp, response } from '@/server/utils';
import { UserService } from './service';
import { validate } from '@/server/utils';
import Joi from 'joi';
import {
  LoginReqData,
  PasswordConfigReqData,
  RegisterReqData,
  SetThemeReqData,
} from '@/types/user';

interface Props {
  service: UserService;
}

export const createUserRouter = (props: Props) => {
  const { service } = props;
  const router = new Router<any, AppKoaContext>({ prefix: '/user' });

  const loginSchema = Joi.object<LoginReqData>({
    a: Joi.string().required(),
    b: Joi.string().allow(null),
  });

  router.post('/login', async (ctx) => {
    const body = validate(ctx, loginSchema);
    if (!body) return;
    const { a, b } = body;

    const resp = await service.login(a, getIp(ctx) || 'anonymous', b);
    response(ctx, resp);
  });

  router.post('/logout', async (ctx) => {
    const resp = await service.logout();
    response(ctx, resp);
  });

  const registerSchema = Joi.object<RegisterReqData>({
    code: Joi.string().required(),
    salt: Joi.string().required(),
  });

  router.post('/createAdmin', async (ctx) => {
    const body = validate(ctx, registerSchema);
    if (!body) return;

    const resp = await service.createAdmin(body);
    response(ctx, resp);
  });

  const changePwdSchema = Joi.object<{ a: string }>({
    a: Joi.string().required(),
  });

  router.post('/changePwd', async (ctx) => {
    const body = validate(ctx, changePwdSchema);
    if (!body) return;

    const resp = await service.changePassword(body.a);
    response(ctx, resp);
  });

  const setThemeSchema = Joi.object<SetThemeReqData>({
    theme: Joi.any().valid('light', 'dark').required(),
  });

  router.post('/setTheme', async (ctx) => {
    const body = validate(ctx, setThemeSchema);
    if (!body) return;
    const { theme } = body;

    const resp = await service.setTheme(theme);
    response(ctx, resp);
  });

  // 统计文章
  router.get('/statistic', async (ctx) => {
    const resp = await service.getCount();
    response(ctx, resp);
  });

  const createPwdSettingSchema = Joi.object<PasswordConfigReqData>({
    pwdAlphabet: Joi.string().allow('').required(),
    pwdLength: Joi.number().required(),
  });

  // 更新密码生成规则
  router.post('/createPwdSetting', async (ctx) => {
    const body = validate(ctx, createPwdSettingSchema);
    if (!body) return;

    const resp = await service.setCreatePwdSetting(body.pwdAlphabet, body.pwdLength);
    response(ctx, resp);
  });

  return router;
};
