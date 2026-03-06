import { Type } from "typebox";

// 设置主题
export const SchemaUserSetThemeBody = Type.Object({
  theme: Type.String({ description: "light | dark" }),
});
export type SchemaUserSetThemeBodyType = Type.Static<
  typeof SchemaUserSetThemeBody
>;

// 统计信息
export const SchemaUserStatisticResponse = Type.Object({
  groupCount: Type.Number(),
  certificateCount: Type.Number(),
});

// 密码生成配置
export const SchemaUserCreatePwdSettingBody = Type.Object({
  createPwdAlphabet: Type.String(),
  createPwdLength: Type.Number({ minimum: 4, maximum: 128 }),
});
export type SchemaUserCreatePwdSettingBodyType = Type.Static<
  typeof SchemaUserCreatePwdSettingBody
>;
export type SchemaUserStatisticResponseType = Type.Static<
  typeof SchemaUserStatisticResponse
>;
