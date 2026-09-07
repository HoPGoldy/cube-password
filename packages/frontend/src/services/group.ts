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
    mutationFn: (data: { id: number; hash?: string; totpCode?: string }) => {
      return requestPost("group/unlock", data);
    },
    onSuccess: () => {
      // 解锁后新变为可达的凭证需进入名称索引与列表缓存，
      // 否则列表显示“解密失败”占位、搜索漏新可达凭证（search 页 staleTime: Infinity）
      queryClient.invalidateQueries({ queryKey: ["groupList"] });
      queryClient.invalidateQueries({ queryKey: ["certificateIndex"] });
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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
      // 级联删除的凭证需从名称索引与列表缓存移除（否则搜索出现幽灵结果）
      queryClient.invalidateQueries({ queryKey: ["certificateIndex"] });
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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
      passwordSalt?: string;
      kdfParams?: string;
    }) => {
      return requestPost("group/update-config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupList"] });
      // 设锁立即从解锁集移除：可达凭证范围变化，索引与列表同步失效
      queryClient.invalidateQueries({ queryKey: ["certificateIndex"] });
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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
