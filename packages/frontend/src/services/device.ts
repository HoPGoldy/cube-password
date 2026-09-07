import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, requestPost } from "./base";
import type {
  SchemaDeviceAddBodyType,
  SchemaDeviceAddResponseType,
  SchemaDeviceItemType,
  SchemaDeviceListResponseType,
} from "@shared-types/device";

/** 设备列表（含最近过门时间，供管理页展示） */
export const useDeviceList = () => {
  return useQuery({
    queryKey: ["deviceList"],
    queryFn: () => requestPost<SchemaDeviceListResponseType>("device/list"),
    refetchOnWindowFocus: false,
  });
};

/** 录入设备（钥匙串格式），成功后失效列表缓存 */
export const useAddDevice = () => {
  return useMutation({
    mutationFn: (data: SchemaDeviceAddBodyType) => {
      return requestPost<SchemaDeviceAddResponseType>("device/add", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deviceList"] });
    },
  });
};

/** 吊销设备，成功后失效列表缓存 */
export const useRevokeDevice = () => {
  return useMutation({
    mutationFn: (data: { id: string }) => {
      return requestPost("device/revoke", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deviceList"] });
    },
  });
};

export type { SchemaDeviceItemType };
