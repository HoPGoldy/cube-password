import { Type } from "typebox";

// 获取二维码
export const SchemaOtpGetQrcodeResponse = Type.Object({
  registered: Type.Boolean(),
  qrCode: Type.Optional(Type.String()),
});
export type SchemaOtpGetQrcodeResponseType = Type.Static<
  typeof SchemaOtpGetQrcodeResponse
>;

// 绑定
export const SchemaOtpBindBody = Type.Object({
  code: Type.String({ description: "TOTP verification code" }),
});
export type SchemaOtpBindBodyType = Type.Static<typeof SchemaOtpBindBody>;

// 解绑
export const SchemaOtpRemoveBody = Type.Object({
  hash: Type.String({ description: "SHA512(password + challenge)" }),
  challengeCode: Type.String(),
  code: Type.String({ description: "TOTP verification code" }),
});
export type SchemaOtpRemoveBodyType = Type.Static<typeof SchemaOtpRemoveBody>;
