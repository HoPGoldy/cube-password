import Router from 'koa-router';
import { AppKoaContext, PageSearchFilter } from '@/types/global';
import { response } from '@/server/utils';
import { SecurityService } from './service';
import { validate } from '@/server/utils';
import Joi from 'joi';

interface Props {
  service: SecurityService;
}

export const createSecurityRouter = (props: Props) => {
  const { service } = props;
  const router = new Router<any, AppKoaContext>({ prefix: '/security' });

  const queryoticeListSchema = Joi.object<PageSearchFilter>({
    page: Joi.number().required(),
  });

  router.get('/noticeList', async (ctx) => {
    const body = validate(ctx, queryoticeListSchema);
    if (!body) return;

    const resp = await service.queryNoticeList(body);
    response(ctx, resp);
  });

  router.post('/readAllNotice', async (ctx) => {
    const resp = await service.readAllNotice();
    response(ctx, resp);
  });

  router.post('/removeAllNotice', async (ctx) => {
    const resp = await service.readAllNotice();
    response(ctx, resp);
  });

  return router;
};
