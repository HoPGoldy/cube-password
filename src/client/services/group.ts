import { useMutation } from 'react-query';
import { requestPost } from './base';
import { AddGroupResp, CertificateGroupStorage, GroupConfigUpdateData } from '@/types/group';

/** 新增分组 */
export const useAddGroup = () => {
  return useMutation(async (data: Omit<CertificateGroupStorage, 'id'>) => {
    return await requestPost<AddGroupResp>('group/add', data);
  });
};

/** 解锁分组 */
export const useGroupLogin = (groupId: number) => {
  return useMutation(async (code: string) => {
    return await requestPost<boolean>(`group/${groupId}/unlock`, {
      code,
    });
  });
};

/** 删除分组 */
export const useDeleteGroup = (groupId: number) => {
  return useMutation(async () => {
    return await requestPost<number>(`group/${groupId}/delete`);
  });
};

/** 更新分组名称 */
export const useUpdateGroupName = (groupId: number) => {
  return useMutation(async (name: string) => {
    return await requestPost(`group/${groupId}/updateName`, {
      name,
    });
  });
};

/** 设置默认分组 */
export const useUpdateDefaultGroup = (groupId: number) => {
  return useMutation(async () => {
    return await requestPost(`group/setDefaultGroup`, { groupId });
  });
};

/** 更新分组设置 */
export const useUpdateGroupConfig = (groupId: number) => {
  return useMutation(async (data: GroupConfigUpdateData) => {
    return await requestPost(`group/${groupId}/updateConfig`, data);
  });
};

/** 更新排序 */
export const useUpdateGroupSort = () => {
  return useMutation(async (groupIds: number[]) => {
    return await requestPost('group/updateSort', { groupIds });
  });
};
