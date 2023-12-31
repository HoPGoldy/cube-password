import { PAGE_SIZE, TABLE_NAME } from '@/config';
import { groupLockResp } from '@/server/constants';
import { DatabaseAccessor } from '@/server/lib/sqlite';
import {
  CertificateStorage,
  SearchCertificateReqData,
  SearchCertificateResp,
} from '@/types/certificate';
import { CertificateListItem } from '@/types/group';
import dayjs from 'dayjs';

interface Props {
  db: DatabaseAccessor;
  isGroupUnlocked: (groupId: number) => boolean;
}

export const createCertificateService = (props: Props) => {
  const { db, isGroupUnlocked } = props;

  /** 查询凭证详情数据 */
  const queryCertificateDetail = async (id: number) => {
    const detail = await db.certificate().select().where('id', id).first();
    // 找不到凭证也返回分组未解密，防止攻击者猜到哪些 id 上有信息
    if (!detail) return groupLockResp;

    const groupUnlocked = isGroupUnlocked(detail.groupId);
    if (!groupUnlocked) return groupLockResp;

    return { code: 200, data: detail };
  };

  /** 更新排序 */
  const updateSort = async (newSortIds: number[]) => {
    const itemOrders = newSortIds.reduce(
      (prev, cur, index) => {
        prev[cur] = index;
        return prev;
      },
      {} as Record<number, number>,
    );

    await db.knex.transaction(async (trx) => {
      return Promise.all(
        newSortIds.map((id) => {
          return trx(TABLE_NAME.CERTIFICATE).update({ order: itemOrders[id] }).where('id', id);
        }),
      );
    });

    return { code: 200 };
  };

  /** 删除凭证 */
  const deleteCertificate = async (certificateIds: number[]) => {
    const certificates = await db
      .certificate()
      .whereIn('id', certificateIds)
      .select('id', 'groupId');

    // 先保证要删除的凭证分组都解锁了
    for (const certificate of certificates) {
      const groupUnlocked = await isGroupUnlocked(certificate.groupId);
      if (!groupUnlocked) return groupLockResp;
    }

    await db.certificate().whereIn('id', certificateIds).delete();

    return { code: 200 };
  };

  /**
   * 批量修改凭证分组
   *
   * @param certificateIds 要移除的凭证 id 数组
   * @param newGroupId 要移动到的新分组 id
   */
  const moveCertificate = async (certificateIds: number[], newGroupId: number) => {
    const certificates = await db
      .certificate()
      .whereIn('id', certificateIds)
      .select('id', 'groupId');

    // 先保证要删除的凭证分组都解锁了
    for (const certificate of certificates) {
      const groupUnlocked = await isGroupUnlocked(certificate.groupId);
      if (!groupUnlocked) return groupLockResp;
    }

    await db
      .certificate()
      .whereIn('id', certificateIds)
      .update('groupId', newGroupId)
      .update('order', -1);

    return { code: 200 };
  };

  /** 添加新凭证 */
  const addCertificate = async (detail: Omit<CertificateStorage, 'id'>) => {
    const groupUnlocked = await isGroupUnlocked(detail.groupId);
    if (!groupUnlocked) return groupLockResp;

    const newData: Omit<CertificateStorage, 'id'> = {
      ...detail,
      icon: detail.icon || 'fa-solid fa-key',
      order: -1,
      createTime: Date.now(),
      updateTime: Date.now(),
    };
    const [id] = await db.certificate().insert(newData);

    return { code: 200, data: { id } };
  };

  /** 修改凭证数据 */
  const updateCertificate = async (detail: Partial<CertificateStorage>) => {
    const oldData = await db.certificate().select().where('id', detail.id).first();
    if (!oldData) return groupLockResp;

    const groupUnlocked = await isGroupUnlocked(oldData.groupId);
    if (!groupUnlocked) return groupLockResp;

    const newData: Partial<CertificateStorage> = {
      ...oldData,
      ...detail,
      createTime: oldData.createTime,
      updateTime: Date.now(),
    };

    await db.certificate().update(newData).where('id', detail.id);
    return { code: 200 };
  };

  /** 查询凭证 */
  const serachCertificate = async (reqData: SearchCertificateReqData) => {
    const { page = 1, colors = [], keyword, desc = true } = reqData;
    const query = db.certificate().select();

    if (colors.length > 0) {
      query.whereIn('markColor', colors);
    }

    if (keyword) {
      query.andWhereLike('name', `%${keyword}%`);
    }

    const { count: total } = (await query.clone().count('id as count').first()) as any;

    const result = await query
      .orderBy('createTime', desc ? 'desc' : 'asc')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    const rows: CertificateListItem[] = result
      .map((item) => ({
        id: item.id,
        name: item.name,
        markColor: item.markColor || '',
        icon: item.icon || '',
        updateTime: dayjs(item.updateTime).format('YYYY-MM-DD HH:mm:ss'),
        groupId: item.groupId,
      }))
      .filter((i) => isGroupUnlocked(i.groupId));

    const data: SearchCertificateResp = { total, rows };

    return { code: 200, data };
  };

  return {
    queryCertificateDetail,
    updateSort,
    deleteCertificate,
    moveCertificate,
    addCertificate,
    serachCertificate,
    updateCertificate,
  };
};

export type CertificateService = ReturnType<typeof createCertificateService>;
