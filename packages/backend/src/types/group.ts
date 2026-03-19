import { Type } from "typebox";

// 分组列表响应中的单项（含凭证数）
export const SchemaGroupItem = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  lockType: Type.String(),
  certificateCount: Type.Number(),
  order: Type.Number(),
  salt: Type.Optional(Type.String()),
});

export type SchemaGroupItemType = Type.Static<typeof SchemaGroupItem>;

// 添加分组
export const SchemaGroupAddBody = Type.Object({
  name: Type.String(),
  lockType: Type.Optional(Type.String({ default: "None" })),
  passwordHash: Type.Optional(Type.String()),
  passwordSalt: Type.Optional(Type.String()),
});
export type SchemaGroupAddBodyType = Type.Static<typeof SchemaGroupAddBody>;

export const SchemaGroupAddResponse = Type.Object({
  newId: Type.Number(),
  newList: Type.Array(SchemaGroupItem),
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
  lockType: Type.String(),
  passwordHash: Type.Optional(Type.String()),
  passwordSalt: Type.Optional(Type.String()),
});

export type SchemaGroupUpdateConfigBodyType = Type.Static<
  typeof SchemaGroupUpdateConfigBody
>;

// 解锁分组
export const SchemaGroupUnlockBody = Type.Object({
  id: Type.Number(),
  hash: Type.Optional(
    Type.String({
      description: "SHA512(SHA512(groupSalt + password) + challenge)",
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
