import { STATUS_CODE, TABLE_NAME } from '@/config';
import { groupLockResp } from '@/server/constants';
import { SessionController } from '@/server/lib/auth';
import { DatabaseAccessor } from '@/server/lib/sqlite';
import {
  AddGroupResp,
  CertificateGroupDetail,
  CertificateGroupStorage,
  CertificateListItem,
  GroupConfigUpdateData,
} from '@/types/group';
import { sha } from '@/utils/crypto';
import dayjs from 'dayjs';

interface Props {
  db: DatabaseAccessor;
  isGroupUnlocked: (groupId: number) => boolean;
  getChallengeCode: () => string | undefined;
  addUnlockedGroup: SessionController['addUnlockedGroup'];
}

export const createGroupService = (props: Props) => {
  const { db, isGroupUnlocked, getChallengeCode, addUnlockedGroup } = props;

  /** 查询分组列表 */
  const queryGroupList = async () => {
    const list = await db.group().select().orderBy('order', 'asc');
    const data = list.map((item) => {
      const newItem: CertificateGroupDetail = {
        id: item.id,
        name: item.name,
        lockType: item.lockType,
      };

      if (item.passwordSalt) newItem.salt = item.passwordSalt;

      return newItem;
    });
    return { code: 200, data };
  };

  /** 创建分组 */
  const addGroup = async (newData: Omit<CertificateGroupStorage, 'id'>) => {
    const [id] = await db.group().insert(newData);
    const list = await queryGroupList();
    const data: AddGroupResp = { newId: id, newList: list.data };
    // 没密码的就直接解锁
    if (!newData.passwordHash && !newData.passwordSalt) addUnlockedGroup(id);
    return { code: 200, data };
  };

  /** 获取指定分组下的凭证列表 */
  const getCertificateList = async (groupId: number) => {
    const groupUnlocked = isGroupUnlocked(groupId);
    if (!groupUnlocked) return groupLockResp;

    const list = await db.certificate().select().where('groupId', groupId).orderBy('order', 'asc');

    const data: CertificateListItem[] = list.map((item) => ({
      id: item.id,
      name: item.name,
      markColor: item.markColor || '',
      updateTime: dayjs(item.updateTime).format('YYYY-MM-DD HH:mm:ss'),
    }));

    return { code: 200, data };
  };

  /** 更新分组名 */
  const updateGroupName = async (groupId: number, newName: string) => {
    const groupUnlocked = isGroupUnlocked(groupId);
    if (!groupUnlocked) return groupLockResp;

    await db.group().update('name', newName).where('id', groupId);
    return { code: 200 };
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
          return trx(TABLE_NAME.GROUP).update({ order: itemOrders[id] }).where('id', id);
        }),
      );
    });

    return { code: 200 };
  };

  /**
   * 设置默认分组
   */
  const setDefaultGroup = async (groupId: number) => {
    await db.user().update('defaultGroupId', groupId);
    return { code: 200 };
  };

  /** 删除分组 */
  const deleteGroup = async (groupId: number) => {
    const groupUnlocked = isGroupUnlocked(groupId);
    if (!groupUnlocked) return groupLockResp;

    const [{ ['count(*)']: groupCount }, includesCertificate] = await Promise.all<[any, any]>([
      db.group().count().first(),
      db.certificate().select().where('groupId', groupId),
    ]);

    if (groupCount <= 1) {
      return { code: STATUS_CODE.CANT_DELETE, msg: '不能移除最后一个分组' };
    }

    await db.group().delete().where('id', groupId);
    if (includesCertificate) {
      await db.certificate().delete().where('groupId', groupId);
    }

    // 看一下是不是把默认分组移除了，是的话就更新一下
    const { defaultGroupId } = (await db.user().select('defaultGroupId').first()) || {};
    if (defaultGroupId === groupId) {
      const firstGroup = await db.group().select('id').first();
      if (!firstGroup) return { code: 500, msg: '找不到分组，无法设置默认分组' };
      await db.user().update('defaultGroupId', firstGroup.id);
      return { code: 200, data: firstGroup.id };
    }

    return { code: 200, data: defaultGroupId };
  };

  /** 分组解锁 */
  const unlockGroup = async (groupId: number, codeHash: string) => {
    const challengeCode = getChallengeCode();
    if (!challengeCode) {
      return { code: 200, msg: '挑战码错误' };
    }

    const groupDetail = await db.group().select('passwordHash').where('id', groupId).first();
    if (!groupDetail) {
      return { code: 404, msg: '分组不存在' };
    }

    const { passwordHash } = groupDetail;
    if (!passwordHash) {
      return { code: 200, msg: '分组不需要密码' };
    }

    if (sha(passwordHash + challengeCode) !== codeHash) {
      return { code: STATUS_CODE.GROUP_PASSWORD_ERROR, msg: '密码错误，请检查分组密码是否正确' };
    }

    addUnlockedGroup(groupId);
    return { code: 200 };
  };

  /** 分组更新配置 */
  const updateGroupConfig = async (groupId: number, data: GroupConfigUpdateData) => {
    const groupUnlocked = isGroupUnlocked(groupId);
    if (!groupUnlocked) return groupLockResp;

    const groupDetail = await db.group().select('passwordHash').where('id', groupId).first();
    if (!groupDetail) {
      return { code: 404, msg: '分组不存在' };
    }

    const newData: Partial<CertificateGroupStorage> = {
      lockType: data.lockType,
      passwordHash: data.passwordHash,
      passwordSalt: data.passwordSalt,
    };

    await db.group().update(newData).where('id', groupId);
    return { code: 200 };
  };

  return {
    queryGroupList,
    addGroup,
    getCertificateList,
    updateGroupName,
    updateSort,
    setDefaultGroup,
    deleteGroup,
    unlockGroup,
    updateGroupConfig,
  };
};

export type GroupService = ReturnType<typeof createGroupService>;
