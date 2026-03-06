import { Type } from "typebox";

// ========== Challenge ==========

export const SchemaChallengeResponse = Type.Object({
  code: Type.String(),
});

// ========== Global ==========

export const SchemaGlobalResponse = Type.Object({
  isInitialized: Type.Boolean(),
});

// ========== Init ==========

export const SchemaAuthInitBody = Type.Object({
  passwordHash: Type.String({ description: "bcrypt hash of password" }),
});

export const SchemaAuthInitResponse = Type.Object({
  success: Type.Boolean(),
});

// ========== Login ==========

export const SchemaAuthLoginBody = Type.Object({
  hash: Type.String({ description: "SHA512(password + challenge)" }),
  challengeCode: Type.String({ description: "The challenge code used" }),
  code: Type.Optional(
    Type.String({ description: "TOTP code for remote login" }),
  ),
});

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
  groups: Type.Array(
    Type.Object({
      id: Type.Number(),
      name: Type.String(),
      lockType: Type.String(),
    }),
  ),
});

// ========== Change Password ==========

export const SchemaAuthChangePasswordBody = Type.Object({
  oldHash: Type.String({ description: "SHA512(oldPassword + challenge)" }),
  challengeCode: Type.String({ description: "The challenge code used" }),
  newPasswordHash: Type.String({ description: "bcrypt hash of new password" }),
});
