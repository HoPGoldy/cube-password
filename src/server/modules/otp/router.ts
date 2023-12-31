import Router from 'koa-router';
import { AppKoaContext } from '@/types/global';
import { response, validate } from '@/server/utils';
import { OtpService } from './service';
import Joi from 'joi';
import { RemoveOtpReqData } from '@/types/otp';

interface Props {
  service: OtpService;
}

export const createOtpRouter = (props: Props) => {
  const { service } = props;
  const router = new Router<any, AppKoaContext>({ prefix: '/otp' });

  router.post('/getQrcode', async (ctx) => {
    const resp = await service.getOtpQrcode();
    response(ctx, resp);
  });

  const registerOtpShema = Joi.object<{ code: string }>({
    code: Joi.string().required(),
  });

  router.post('/bind', async (ctx) => {
    const data = validate(ctx, registerOtpShema);
    if (!data) return;

    const resp = await service.bindOtp(data.code);
    response(ctx, resp);
  });

  const removeOtpShema = Joi.object<RemoveOtpReqData>({
    a: Joi.string().required(),
    b: Joi.string().required(),
  });

  router.post('/remove', async (ctx) => {
    const data = validate(ctx, removeOtpShema);
    if (!data) return;

    const resp = await service.removeOtp(data.a, data.b);
    response(ctx, resp);
  });

  return router;
};
