import { Type } from "typebox";

// ========== Login Fail Record ==========

export const SchemaLoginFailRecord = Type.Object({
  ip: Type.String(),
  date: Type.Number(),
  location: Type.String(),
});

// ========== Challenge ==========

export const SchemaChallengeResponse = Type.Object({
  code: Type.String(),
});
export type SchemaChallengeResponseType = Type.Static<
  typeof SchemaChallengeResponse
>;

// ========== Global ==========

export const SchemaGlobalResponse = Type.Object({
  isInitialized: Type.Boolean(),
  salt: Type.Optional(Type.String()),
  loginFailure: Type.Array(SchemaLoginFailRecord),
  retryNumber: Type.Number(),
  isBanned: Type.Boolean(),
});
export type SchemaGlobalResponseType = Type.Static<typeof SchemaGlobalResponse>;

// ========== Init ==========

export const SchemaAuthInitBody = Type.Object({
  passwordHash: Type.String({ description: "SHA512(salt + password)" }),
  passwordSalt: Type.String({ description: "Random salt (nanoid 128)" }),
});
export type SchemaAuthInitBodyType = Type.Static<typeof SchemaAuthInitBody>;

export const SchemaAuthInitResponse = Type.Object({
  success: Type.Boolean(),
});
export type SchemaAuthInitResponseType = Type.Static<
  typeof SchemaAuthInitResponse
>;

// ========== Login ==========

export const SchemaAuthLoginBody = Type.Object({
  hash: Type.String({ description: "SHA512(password + challenge)" }),
  challengeCode: Type.String({ description: "The challenge code used" }),
  code: Type.Optional(
    Type.String({ description: "TOTP code for remote login" }),
  ),
});
export type SchemaAuthLoginBodyType = Type.Static<typeof SchemaAuthLoginBody>;

export const SchemaAuthLoginResponse = Type.Object({
  token: Type.String(),
  replayAttackSecret: Type.String(),
  theme: Type.String(),
  initTime: Type.String(),
  defaultGroupId: Type.Number(),
  hasNotice: Type.Boolean(),
  withTotp: Type.Boolean(),
  createPwdAlphabet: Type.String(),
  createPwdLength: Type.Number(),
  salt: Type.String(),
  groups: Type.Array(
    Type.Object({
      id: Type.Number(),
      name: Type.String(),
      lockType: Type.String(),
      salt: Type.Optional(Type.String()),
    }),
  ),
});
export type SchemaAuthLoginResponseType = Type.Static<
  typeof SchemaAuthLoginResponse
>;

// ========== Change Password ==========

export const SchemaAuthChangePasswordBody = Type.Object({
  a: Type.String({
    description: "AES-encrypted JSON {oldPassword, newPassword}",
  }),
});
export type SchemaAuthChangePasswordBodyType = Type.Static<
  typeof SchemaAuthChangePasswordBody
>;
