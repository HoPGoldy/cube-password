import { Type } from "typebox";

// 分组锁类型（新增/更新配置时强校验，非法值 400）
export const SchemaLockType = Type.Union(
  [Type.Literal("None"), Type.Literal("Password"), Type.Literal("Totp")],
  { default: "None" },
);

// 分组列表响应中的单项（含凭证数）
export const SchemaGroupItem = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  lockType: Type.String(),
  certificateCount: Type.Number(),
  order: Type.Number(),
  salt: Type.Optional(Type.String()),
  kdfParams: Type.Optional(
    Type.String({
      description:
        "JSON: 分组锁密码派生参数（空串/缺省 = 旧版 v1 锁密码，解锁时拒绝）",
    }),
  ),
});

export type SchemaGroupItemType = Type.Static<typeof SchemaGroupItem>;

// 添加分组
export const SchemaGroupAddBody = Type.Object({
  name: Type.String(),
  lockType: Type.Optional(SchemaLockType),
  passwordHash: Type.Optional(
    Type.String({ description: "hex(V)，V = argon2id 输出后 32 字节" }),
  ),
  passwordSalt: Type.Optional(
    Type.String({ description: "hex(KDF salt)，前端生成（32 字节）" }),
  ),
  kdfParams: Type.Optional(
    Type.String({
      description:
        'JSON: {"algorithm":"argon2id","m":65536,"t":2,"p":1,"version":1}',
    }),
  ),
});
export type SchemaGroupAddBodyType = Type.Static<typeof SchemaGroupAddBody>;

export const SchemaGroupAddResponse = Type.Object({
  newId: Type.Number(),
});
export type SchemaGroupAddResponseType = Type.Static<
  typeof SchemaGroupAddResponse
>;

// 分组列表
export const SchemaGroupListResponse = Type.Object({
  items: Type.Array(SchemaGroupItem),
});

// 重命名
export const SchemaGroupUpdateNameBody = Type.Object({
  id: Type.Number(),
  name: Type.String(),
});

// 更新锁定配置
export const SchemaGroupUpdateConfigBody = Type.Object({
  id: Type.Number(),
  lockType: SchemaLockType,
  passwordHash: Type.Optional(
    Type.String({ description: "hex(V)，V = argon2id 输出后 32 字节" }),
  ),
  passwordSalt: Type.Optional(
    Type.String({ description: "hex(KDF salt)，前端生成（32 字节）" }),
  ),
  kdfParams: Type.Optional(
    Type.String({
      description:
        'JSON: {"algorithm":"argon2id","m":65536,"t":2,"p":1,"version":1}',
    }),
  ),
});

export type SchemaGroupUpdateConfigBodyType = Type.Static<
  typeof SchemaGroupUpdateConfigBody
>;

// 解锁分组
export const SchemaGroupUnlockBody = Type.Object({
  id: Type.Number(),
  hash: Type.Optional(
    Type.String({
      description:
        "SHA512(hex(V) + challenge)，V = argon2id(password, salt, kdfParams) 输出后 32 字节",
    }),
  ),
  totpCode: Type.Optional(Type.String()),
});

// 删除分组
export const SchemaGroupDeleteBody = Type.Object({
  id: Type.Number(),
});

// 排序
export const SchemaGroupSortBody = Type.Object({
  ids: Type.Array(Type.Number()),
});

// 设置默认分组
export const SchemaGroupSetDefaultBody = Type.Object({
  id: Type.Number(),
});
export type SchemaGroupSetDefaultBodyType = Type.Static<
  typeof SchemaGroupSetDefaultBody
>;
