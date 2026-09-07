// ========== /device/challenge、/device/verify、/device/add、/device/list、/device/revoke ==========
// 全部接口 Schema 定义在 @/types/device（前后端共享，前端经 @shared-types/device 引用类型），
// 此处 re-export 供 controller 组装。
export {
  SchemaDeviceChallengeBody,
  SchemaDeviceChallengeResponse,
  SchemaDeviceVerifyBody,
  SchemaDeviceVerifyResponse,
  SchemaDeviceAddBody,
  SchemaDeviceAddResponse,
  SchemaDeviceItem,
  SchemaDeviceListBody,
  SchemaDeviceListResponse,
  SchemaDeviceRevokeBody,
  SchemaDeviceRevokeResponse,
} from "@/types/device";
export type {
  SchemaDeviceChallengeBodyType,
  SchemaDeviceChallengeResponseType,
  SchemaDeviceVerifyBodyType,
  SchemaDeviceVerifyResponseType,
  SchemaDeviceAddBodyType,
  SchemaDeviceAddResponseType,
  SchemaDeviceItemType,
  SchemaDeviceListBodyType,
  SchemaDeviceListResponseType,
  SchemaDeviceRevokeBodyType,
  SchemaDeviceRevokeResponseType,
} from "@/types/device";
