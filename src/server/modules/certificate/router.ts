import Router from 'koa-router';
import { AppKoaContext } from '@/types/global';
import { response } from '@/server/utils';
import { CertificateService } from './service';
import { validate } from '@/server/utils';
import Joi from 'joi';
import { Random } from 'mockjs';
import {
  CertificateMoveReqBody,
  CertificateStorage,
  SearchCertificateReqData,
} from '@/types/certificate';

interface Props {
  service: CertificateService;
}

export const createCertificateRouter = (props: Props) => {
  const { service } = props;
  const router = new Router<any, AppKoaContext>({ prefix: '/certificate' });

  router.get('/:certificateId/getDetail', async (ctx) => {
    const certificateId = +ctx.params.certificateId;
    const resp = await service.queryCertificateDetail(certificateId);
    response(ctx, resp);
  });

  /**
   * 获取一个随机英文名
   */
  router.get('/randName', async (ctx) => {
    const data = Random.name(true).replaceAll(' ', '');
    response(ctx, { code: 200, data });
  });

  const deleteCertificateSchema = Joi.object<{ ids: number[] }>({
    ids: Joi.array().items(Joi.number()).required(),
  });

  router.post('/delete', async (ctx) => {
    const body = validate(ctx, deleteCertificateSchema);
    if (!body) return;

    const resp = await service.deleteCertificate(body.ids);
    response(ctx, resp);
  });

  const moveCertificateSchema = Joi.object<CertificateMoveReqBody>({
    ids: Joi.array().items(Joi.number()).required(),
    newGroupId: Joi.number().required(),
  });

  router.post('/move', async (ctx) => {
    const body = validate(ctx, moveCertificateSchema);
    if (!body) return;

    const resp = await service.moveCertificate(body.ids, body.newGroupId);
    response(ctx, resp);
  });

  const addCertificateSchema = Joi.object<Omit<CertificateStorage, 'id'>>({
    name: Joi.string().required(),
    groupId: Joi.number().required(),
    markColor: Joi.string().allow(''),
    icon: Joi.string().allow(''),
    content: Joi.string().required(),
    order: Joi.number().allow(''),
  });

  router.post('/add', async (ctx) => {
    const body = validate(ctx, addCertificateSchema);
    if (!body) return;

    const resp = await service.addCertificate(body);
    response(ctx, resp);
  });

  const updateCertificateSortSchema = Joi.object<{ ids: number[] }>({
    ids: Joi.array().items(Joi.number()).required(),
  });

  router.post('/updateSort', async (ctx) => {
    const body = validate(ctx, updateCertificateSortSchema);
    if (!body) return;

    const resp = await service.updateSort(body.ids);
    response(ctx, resp);
  });

  const updateCertificateSchema = Joi.object<Partial<CertificateStorage>>({
    id: Joi.number().required(),
    name: Joi.string(),
    groupId: Joi.number(),
    markColor: Joi.string().allow(''),
    icon: Joi.string().allow(''),
    content: Joi.string(),
    order: Joi.number().allow(''),
  });

  router.post('/updateDetail', async (ctx) => {
    const body = validate(ctx, updateCertificateSchema);
    if (!body) return;

    const resp = await service.updateCertificate(body);
    response(ctx, resp);
  });

  const searchCertificateShema = Joi.object<SearchCertificateReqData>({
    keyword: Joi.string().allow(''),
    colors: Joi.array().items(Joi.string()).allow(null),
    desc: Joi.boolean().allow(null),
    page: Joi.number().allow(null),
  });

  router.post('/search', async (ctx) => {
    const query = validate(ctx, searchCertificateShema);
    if (!query) return;

    const resp = await service.serachCertificate(query);
    response(ctx, resp);
  });

  return router;
};
