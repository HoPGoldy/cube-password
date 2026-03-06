import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, requestPost } from "./base";
import type {
  SchemaGroupAddBodyType,
  SchemaGroupAddResponseType,
  SchemaGroupItemType,
} from "@shared-types/group";

/** 分组列表 */
export const useGroupList = () => {
  return useQuery({
    queryKey: ["groupList"],
    queryFn: () => requestPost<{ items: SchemaGroupItemType[] }>("group/list"),
    refetchOnWindowFocus: false,
  });
};

/** 新增分组 */
export const useAddGroup = () => {
  return useMutation({
    mutationFn: (data: SchemaGroupAddBodyType) => {
      return requestPost<SchemaGroupAddResponseType>("group/add", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupList"] });
    },
  });
};

/** 解锁分组 */
export const useUnlockGroup = () => {
  return useMutation({
    mutationFn: (data: {
      id: number;
      hash?: string;
      challengeCode?: string;
      totpCode?: string;
    }) => {
      return requestPost("group/unlock", data);
    },
  });
};

/** 删除分组 */
export const useDeleteGroup = () => {
  return useMutation({
    mutationFn: (data: { id: number }) => {
      return requestPost("group/delete", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupList"] });
    },
  });
};

/** 更新分组名称 */
export const useUpdateGroupName = () => {
  return useMutation({
    mutationFn: (data: { id: number; name: string }) => {
      return requestPost("group/update-name", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupList"] });
    },
  });
};

/** 更新分组配置 */
export const useUpdateGroupConfig = () => {
  return useMutation({
    mutationFn: (data: {
      id: number;
      lockType: string;
      passwordHash?: string;
    }) => {
      return requestPost("group/update-config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupList"] });
    },
  });
};

/** 设置默认分组 */
export const useSetDefaultGroup = () => {
  return useMutation({
    mutationFn: (data: { id: number }) => {
      return requestPost("group/set-default", data);
    },
  });
};

/** 更新排序 */
export const useUpdateGroupSort = () => {
  return useMutation({
    mutationFn: (ids: number[]) => {
      return requestPost("group/sort", { ids });
    },
  });
};
