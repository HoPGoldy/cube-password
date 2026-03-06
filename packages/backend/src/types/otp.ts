import { Type } from "typebox";

// 获取二维码
export const SchemaOtpGetQrcodeResponse = Type.Object({
  registered: Type.Boolean(),
  qrCode: Type.Optional(Type.String()),
});

// 绑定
export const SchemaOtpBindBody = Type.Object({
  code: Type.String({ description: "TOTP verification code" }),
});

// 解绑
export const SchemaOtpRemoveBody = Type.Object({
  hash: Type.String({ description: "SHA512(password + challenge)" }),
  challengeCode: Type.String(),
  code: Type.String({ description: "TOTP verification code" }),
});
