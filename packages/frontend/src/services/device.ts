import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, requestPost } from "./base";
import type {
  SchemaDeviceAddBodyType,
  SchemaDeviceAddResponseType,
  SchemaDeviceGateConfigResponseType,
  SchemaDeviceGateConfigUpdateBodyType,
  SchemaDeviceGateConfigUpdateResponseType,
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
      // deviceCount 派生自清单，必须同步失效避免缓存失联
      // （否则吊销唯一设备后 gateConfig.deviceCount 滞留 1，再开开关走错分支）
      queryClient.invalidateQueries({ queryKey: ["gateConfig"] });
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
      // deviceCount 派生自清单，必须同步失效避免缓存失联
      // （否则吊销唯一设备后 gateConfig.deviceCount 滞留 1，再开开关走错分支）
      queryClient.invalidateQueries({ queryKey: ["gateConfig"] });
    },
  });
};

export type { SchemaDeviceItemType };

// ========== 设备门开关（docs/plans/gate-switch T02） ==========

/** 设备门开关状态 + 受信设备数（管理页初始渲染与首次开启引导判定） */
export const gateConfigQueryOptions = {
  queryKey: ["gateConfig"],
  queryFn: () =>
    requestPost<SchemaDeviceGateConfigResponseType>("device/gate-config"),
  refetchOnWindowFocus: false,
};

export const useGateConfig = () => {
  return useQuery(gateConfigQueryOptions);
};

/** 切换设备门开关（开启需已有设备，后端守卫 400），成功后失效开关状态缓存 */
export const updateGateConfigMutationOptions = {
  mutationFn: (data: SchemaDeviceGateConfigUpdateBodyType) => {
    return requestPost<SchemaDeviceGateConfigUpdateResponseType>(
      "device/gate-config-update",
      data,
    );
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["gateConfig"] });
  },
};

export const useUpdateGateConfig = () => {
  return useMutation(updateGateConfigMutationOptions);
};
