import { Type } from "typebox";

// ========== Device Gate 前后端共享 Schema（见 docs/plans/device-gate/context.md 3.3） ==========
// 全部设备接口 Schema 集中在此，模块内的 controller schema 从这里 re-export 组装；
// 前端经 @shared-types/device 引用类型。

/** POST /device/challenge 请求（门禁探针，豁免门禁与 session） */
export const SchemaDeviceChallengeBody = Type.Object({});
export type SchemaDeviceChallengeBodyType = Type.Static<
  typeof SchemaDeviceChallengeBody
>;

export const SchemaDeviceChallengeResponse = Type.Object({
  challenge: Type.String({
    description: "设备挑战码（base64url，32 字节熵，供设备私钥签名）",
  }),
  gateEnabled: Type.Boolean({
    description:
      "设备门是否激活（trusted-devices.json 非空）。false 时前端直接渲染密码表单",
  }),
});
export type SchemaDeviceChallengeResponseType = Type.Static<
  typeof SchemaDeviceChallengeResponse
>;

/** POST /device/verify 请求（设备验签过门，豁免门禁与 session） */
export const SchemaDeviceVerifyBody = Type.Object({
  deviceId: Type.Optional(
    Type.String({
      description:
        "设备 id（trusted-devices.json 中登记）；跨设备录入后源机器尚不知道自己的服务端 id，可省略——服务端对全部受信设备逐一验签",
    }),
  ),
  challenge: Type.String({ description: "/device/challenge 下发的挑战码" }),
  signature: Type.String({
    description:
      "challenge 的 ECDSA P-256 签名（raw r||s，ieee-p1363，base64）",
  }),
});
export type SchemaDeviceVerifyBodyType = Type.Static<
  typeof SchemaDeviceVerifyBody
>;

export const SchemaDeviceVerifyResponse = Type.Object({
  gateToken: Type.String({
    description:
      "门禁令牌（内存态，3 分钟 TTL 防御性上限，即取即用），通过 X-Gate-Token header 携带以访问登录走廊",
  }),
});
export type SchemaDeviceVerifyResponseType = Type.Static<
  typeof SchemaDeviceVerifyResponse
>;

/** 设备列表响应中的单项（含最近过门时间） */
export const SchemaDeviceItem = Type.Object({
  id: Type.String(),
  name: Type.String(),
  publicKey: Type.String(),
  createdAt: Type.String({ description: "ISO 8601" }),
  lastSeenAt: Type.String({ description: "ISO 8601，最近一次过门时间" }),
});
export type SchemaDeviceItemType = Type.Static<typeof SchemaDeviceItem>;

/** POST /device/add 请求（录入受信设备） */
export const SchemaDeviceAddBody = Type.Object({
  deviceKey: Type.String({
    description:
      "设备钥匙串 cube-device-key:v1:<base64url(JSON{ name, publicKey })>",
  }),
});
export type SchemaDeviceAddBodyType = Type.Static<typeof SchemaDeviceAddBody>;

export const SchemaDeviceAddResponse = Type.Object({
  id: Type.String({ description: "新设备的 id" }),
});
export type SchemaDeviceAddResponseType = Type.Static<
  typeof SchemaDeviceAddResponse
>;

/** POST /device/list 请求 */

export const SchemaDeviceListResponse = Type.Object({
  items: Type.Array(SchemaDeviceItem),
});
export type SchemaDeviceListResponseType = Type.Static<
  typeof SchemaDeviceListResponse
>;

/** POST /device/revoke 请求 */
export const SchemaDeviceRevokeBody = Type.Object({
  id: Type.String({ description: "待吊销设备的 id" }),
});
export type SchemaDeviceRevokeBodyType = Type.Static<
  typeof SchemaDeviceRevokeBody
>;

export const SchemaDeviceRevokeResponse = Type.Object({});
export type SchemaDeviceRevokeResponseType = Type.Static<
  typeof SchemaDeviceRevokeResponse
>;
