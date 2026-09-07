import { Type } from "typebox";

// ========== Login Fail Record ==========

export const SchemaLoginFailRecord = Type.Object({
  date: Type.Number(),
});
export type SchemaLoginFailRecordType = Type.Static<
  typeof SchemaLoginFailRecord
>;

// ========== Lock Detail ==========

/** 登录锁定详情（全局锁定语义，与 LoginLocker.getLockDetail 同构） */
export const SchemaLockDetail = Type.Object({
  loginFailure: Type.Array(SchemaLoginFailRecord),
  retryNumber: Type.Number(),
  isBanned: Type.Boolean(),
});
export type SchemaLockDetailType = Type.Static<typeof SchemaLockDetail>;

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
  kdfParams: Type.Optional(
    Type.String({
      description: "JSON: 登录派生所需的 KDF 参数（未初始化时不下发）",
    }),
  ),
  loginFailure: Type.Array(SchemaLoginFailRecord),
  retryNumber: Type.Number(),
  isBanned: Type.Boolean(),
});
export type SchemaGlobalResponseType = Type.Static<typeof SchemaGlobalResponse>;

// ========== Init ==========

export const SchemaAuthInitBody = Type.Object({
  verifier: Type.String({ description: "hex(V)，V = argon2id 输出后 32 字节" }),
  salt: Type.String({ description: "hex(KDF salt)，前端生成（32 字节）" }),
  keyBlob: Type.String({ description: "v2 格式：AES-256-GCM(KEK, DEK)" }),
  kdfParams: Type.String({
    description:
      'JSON: {"algorithm":"argon2id","m":65536,"t":2,"p":1,"version":1}',
  }),
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
  hash: Type.String({ description: "SHA512(hex(V) + challengeCode)" }),
});
export type SchemaAuthLoginBodyType = Type.Static<typeof SchemaAuthLoginBody>;

export const SchemaAuthLoginResponse = Type.Object({
  token: Type.String(),
  /** 会话绝对过期时刻（ISO 8601），前端倒计时以此为准 */
  expiresAt: Type.String({
    description: "会话绝对过期时刻（ISO 8601），任何活跃操作都不续期",
  }),
  theme: Type.String(),
  initTime: Type.String(),
  defaultGroupId: Type.Number(),
  hasNotice: Type.Boolean(),
  withTotp: Type.Boolean(),
  createPwdAlphabet: Type.String(),
  createPwdLength: Type.Number(),
  salt: Type.String(),
  keyBlob: Type.String({
    description: "v2 格式：AES-256-GCM(KEK, DEK)，前端用 KEK 解出 DEK",
  }),
  kdfParams: Type.String({ description: "JSON: 登录派生所需的 KDF 参数" }),
  groups: Type.Array(
    Type.Object({
      id: Type.Number(),
      name: Type.String(),
      lockType: Type.String(),
      salt: Type.Optional(Type.String()),
      kdfParams: Type.Optional(
        Type.String({
          description:
            "JSON: 分组锁密码派生参数（空串/缺省 = 旧版 v1 锁密码，解锁时拒绝）",
        }),
      ),
    }),
  ),
});
export type SchemaAuthLoginResponseType = Type.Static<
  typeof SchemaAuthLoginResponse
>;

// ========== Change Password ==========

export const SchemaAuthChangePasswordBody = Type.Object({
  verifier: Type.String({ description: "hex(newV)，新密码的 argon2id 验证者" }),
  hash: Type.String({
    description:
      "旧密码证明：SHA512(hex(V_old) + challengeCode)，V_old 为旧密码派生的验证者",
  }),
  salt: Type.String({ description: "hex(newKDF salt)，前端生成（32 字节）" }),
  keyBlob: Type.String({ description: "v2 格式：新 KEK 重包衷后的 DEK" }),
  totp: Type.Optional(
    Type.String({ description: "TOTP 码（启用 TOTP 时必填）" }),
  ),
});
export type SchemaAuthChangePasswordBodyType = Type.Static<
  typeof SchemaAuthChangePasswordBody
>;
