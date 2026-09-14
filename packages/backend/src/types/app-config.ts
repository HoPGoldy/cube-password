import { Type } from "typebox";

/** 设备门开闭开关的 AppConfig 键（唯一判定入口 DeviceService.isGateEnabled，见 docs/plans/gate-switch/context.md） */
export const APP_CONFIG_KEY_DEVICE_GATE_ENABLED = "deviceGateEnabled";

export const SchemaAppConfig = Type.Record(Type.String(), Type.String());
export type SchemaAppConfigType = Type.Static<typeof SchemaAppConfig>;

export const SchemaAppVersionResponse = Type.Object({
  version: Type.String(),
  name: Type.String(),
  repository: Type.Union([Type.String(), Type.Null()]),
});
export type SchemaAppVersionResponseType = Type.Static<
  typeof SchemaAppVersionResponse
>;
