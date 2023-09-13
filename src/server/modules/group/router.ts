import Router from 'koa-router';
import { AppKoaContext } from '@/types/global';
import { response } from '@/server/utils';
import { GroupService } from './service';
import { validate } from '@/server/utils';
import Joi from 'joi';
import { CertificateGroupStorage, GroupConfigUpdateData } from '@/types/group';

interface Props {
  service: GroupService;
}

export const createGroupRouter = (props: Props) => {
  const { service } = props;
  const router = new Router<any, AppKoaContext>({ prefix: '/group' });

  const addGroupSchema = Joi.object<Omit<CertificateGroupStorage, 'id'>>({
    name: Joi.string().required(),
    order: Joi.number().required(),
    passwordHash: Joi.string().allow(null),
    passwordSalt: Joi.string().allow(null),
  }).with('passwordHash', 'passwordSalt');

  // 新增分组
  router.post('/add', async (ctx) => {
    const body = validate(ctx, addGroupSchema);
    if (!body) return;

    const resp = await service.addGroup(body);
    response(ctx, resp);
  });

  // 查询分组下属凭证
  router.get('/:groupId/certificates', async (ctx) => {
    const groupId = +ctx.params.groupId;

    const certificates = await service.getCertificateList(groupId);
    response(ctx, certificates);
  });

  const updateGroupSchema = Joi.object<{ name: string }>({
    name: Joi.string().required(),
  });

  // 更新分组名称
  router.post('/:groupId/updateName', async (ctx) => {
    const body = validate(ctx, updateGroupSchema);
    if (!body) return;

    const groupId = +ctx.params.groupId;
    const resp = await service.updateGroupName(groupId, body.name);
    response(ctx, resp);
  });

  const updateGroupSortSchema = Joi.object<{ groupIds: number[] }>({
    groupIds: Joi.array().items(Joi.number()).required(),
  });

  // 更新分组排序
  router.post('/updateSort', async (ctx) => {
    const body = validate(ctx, updateGroupSortSchema);
    if (!body) return;

    const resp = await service.updateSort(body.groupIds);
    response(ctx, resp);
  });

  const setDefaultGroupSchema = Joi.object<{ groupId: number }>({
    groupId: Joi.number().required(),
  });

  // 设置默认分组
  router.post('/setDefaultGroup', async (ctx) => {
    const body = validate(ctx, setDefaultGroupSchema);
    if (!body) return;

    const resp = await service.setDefaultGroup(body.groupId);
    response(ctx, resp);
  });

  // 删除分组
  router.post('/:groupId/delete', async (ctx) => {
    const groupId = +ctx.params.groupId;
    const resp = await service.deleteGroup(groupId);
    response(ctx, resp);
  });

  // 分组解密
  router.post('/:groupId/unlock', async (ctx) => {
    const { code } = ctx.request.body;
    if (!code || typeof code !== 'string') {
      response(ctx, { code: 401, msg: '无效的分组密码凭证' });
      return;
    }

    const groupId = +ctx.params.groupId;
    const resp = await service.unlockGroup(groupId, code);
    response(ctx, resp);
  });

  const updateConfigSchema = Joi.object<GroupConfigUpdateData>({
    lockType: Joi.string().required(),
    passwordHash: Joi.string().allow(null),
    passwordSalt: Joi.string().allow(null),
  });

  // 分组更新配置
  router.post('/:groupId/updateConfig', async (ctx) => {
    const body = validate(ctx, updateConfigSchema);
    if (!body) return;

    const groupId = +ctx.params.groupId;
    const resp = await service.updateGroupConfig(groupId, body);
    response(ctx, resp);
  });

  return router;
};
