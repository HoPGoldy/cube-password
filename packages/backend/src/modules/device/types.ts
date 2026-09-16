// ========== /device/challenge、/device/verify、/device/add、/device/list、/device/revoke、/device/gate-config、/device/gate-config-update ==========
// 全部接口 Schema 定义在 @/types/device（前后端共享，前端经 @shared-types/device 引用类型），
// 此处 re-export 供 controller 组装。
export {
  SchemaDeviceChallengeResponse,
  SchemaDeviceVerifyBody,
  SchemaDeviceVerifyResponse,
  SchemaDeviceAddBody,
  SchemaDeviceAddResponse,
  SchemaDeviceItem,
  SchemaDeviceListResponse,
  SchemaDeviceRevokeBody,
  SchemaDeviceRevokeResponse,
  SchemaDeviceGateConfigBody,
  SchemaDeviceGateConfigResponse,
  SchemaDeviceGateConfigUpdateBody,
  SchemaDeviceGateConfigUpdateResponse,
} from "@/types/device";
export type {
  SchemaDeviceChallengeResponseType,
  SchemaDeviceVerifyBodyType,
  SchemaDeviceVerifyResponseType,
  SchemaDeviceAddBodyType,
  SchemaDeviceAddResponseType,
  SchemaDeviceItemType,
  SchemaDeviceListResponseType,
  SchemaDeviceRevokeBodyType,
  SchemaDeviceRevokeResponseType,
  SchemaDeviceGateConfigBodyType,
  SchemaDeviceGateConfigResponseType,
  SchemaDeviceGateConfigUpdateBodyType,
  SchemaDeviceGateConfigUpdateResponseType,
} from "@/types/device";
