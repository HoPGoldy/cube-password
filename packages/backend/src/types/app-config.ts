import { Type } from "typebox";

/** 设备门开闭开关的 AppConfig 键（唯一判定入口 DeviceService.isGateEnabled，见 docs/plans/gate-switch/context.md） */
export const APP_CONFIG_KEY_DEVICE_GATE_ENABLED = "deviceGateEnabled";

// 注意：不提供通用配置读写接口。AppConfig 的写入口唯一收敛在
// /device/gate-config-update（带「开启前必须有设备」守卫），
// 防止旁路写入 deviceGateEnabled 绕过守卫制造 fail-closed 死局。

export const SchemaAppVersionResponse = Type.Object({
  version: Type.String(),
  name: Type.String(),
  repository: Type.Union([Type.String(), Type.Null()]),
});
export type SchemaAppVersionResponseType = Type.Static<
  typeof SchemaAppVersionResponse
>;
