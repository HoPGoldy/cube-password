import Router from 'koa-router';
import { AppKoaContext } from '@/types/global';
import { response } from '@/server/utils';
import { SecurityService } from './service';
import { validate } from '@/server/utils';
import Joi from 'joi';
import { SearchNoticeFilter } from '@/types/security';

interface Props {
  service: SecurityService;
}

export const createSecurityRouter = (props: Props) => {
  const { service } = props;
  const router = new Router<any, AppKoaContext>({ prefix: '/security' });

  const queryoticeListSchema = Joi.object<SearchNoticeFilter>({
    page: Joi.number().required(),
    isRead: Joi.number().allow(null),
    type: Joi.number().allow(null),
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
