import { CertificateGroupDetail, LockType } from '@/types/group';
import { atom, useAtom } from 'jotai';

export interface GroupDetail extends CertificateGroupDetail {
  /** 这个字段标注了某个分组是否被用户解锁了 */
  unlocked: boolean;
}

/**
 * 当前用户的分组列表
 */
export const stateGroupList = atom<GroupDetail[]>([]);

/**
 * 把后端的分组列表转换成前端需要的格式
 */
export const rebuildGroup = (item: CertificateGroupDetail) => {
  return {
    ...item,
    unlocked: item.lockType === LockType.None,
  };
};

/**
 * 获取指定分组的相关操作
 */
export const useGroup = (groupId: number) => {
  const [groupList, setGroupList] = useAtom(stateGroupList);
  const group = groupList.find((group) => group.id === groupId);

  const updateGroup = (newData: Partial<GroupDetail>) => {
    setGroupList((prev) => {
      return prev.map((group) => {
        if (group.id !== groupId) return { ...group };
        return { ...group, ...newData };
      });
    });
  };

  const deleteGroup = () => {
    setGroupList((prev) => {
      const newGroupList = prev.filter((item) => item.id !== groupId);
      return newGroupList;
    });
  };

  return { group, updateGroup, deleteGroup };
};
