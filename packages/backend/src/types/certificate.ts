import { Type } from "typebox";

// 按分组列出凭证
export const SchemaCertificateListByGroupBody = Type.Object({
  groupId: Type.Number(),
});

export const SchemaCertificateListByGroupResponse = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.Number(),
      name: Type.String(),
      nameEnc: Type.String(),
      markColor: Type.Union([Type.String(), Type.Null()]),
      icon: Type.Union([Type.String(), Type.Null()]),
      updatedAt: Type.String(),
    }),
  ),
});
export type SchemaCertificateListByGroupResponseType = Type.Static<
  typeof SchemaCertificateListByGroupResponse
>;

// 添加凭证（迁移期 name 与 nameEnc 双字段并存：e2e/旧客户端仍传 name，新前端只传 nameEnc）
export const SchemaCertificateAddBody = Type.Object({
  name: Type.Optional(Type.String()),
  nameEnc: Type.Optional(Type.String()),
  groupId: Type.Number(),
  content: Type.Optional(Type.String()),
  markColor: Type.Optional(Type.String()),
  icon: Type.Optional(Type.String()),
  order: Type.Optional(Type.Number()),
});

export const SchemaCertificateAddResponse = Type.Object({
  id: Type.Number(),
});
export type SchemaCertificateAddBodyType = Type.Static<
  typeof SchemaCertificateAddBody
>;

// 全量凭证索引（元数据加密：前端拉取后用 DEK 解密 nameEnc 构建内存明文索引）
export const SchemaCertificateIndexResponse = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.Number(),
      nameEnc: Type.String(),
      icon: Type.Union([Type.String(), Type.Null()]),
      markColor: Type.Union([Type.String(), Type.Null()]),
      updatedAt: Type.String(),
      groupId: Type.Number(),
    }),
  ),
});
export type SchemaCertificateIndexResponseType = Type.Static<
  typeof SchemaCertificateIndexResponse
>;

// 凭证详情
export const SchemaCertificateDetailBody = Type.Object({
  id: Type.Number(),
});

export const SchemaCertificateDetailResponse = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  nameEnc: Type.String(),
  groupId: Type.Number(),
  content: Type.String(),
  markColor: Type.Union([Type.String(), Type.Null()]),
  icon: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

// 更新凭证（迁移期 name 与 nameEnc 双字段并存，均可选）
export const SchemaCertificateUpdateBody = Type.Object({
  id: Type.Number(),
  name: Type.Optional(Type.String()),
  nameEnc: Type.Optional(Type.String()),
  groupId: Type.Number(),
  content: Type.Optional(Type.String()),
  markColor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  order: Type.Optional(Type.Number()),
});

// 删除凭证
export const SchemaCertificateDeleteBody = Type.Object({
  ids: Type.Array(Type.Number()),
});

// 移动凭证
export const SchemaCertificateMoveBody = Type.Object({
  ids: Type.Array(Type.Number()),
  newGroupId: Type.Number(),
});

// 排序
export const SchemaCertificateSortBody = Type.Object({
  ids: Type.Array(Type.Number()),
});

export type SchemaCertificateMoveBodyType = Type.Static<
  typeof SchemaCertificateMoveBody
>;

// 元数据迁移（凭证名称密文化）：单事务批量写 nameEnc；finish=true 同事务收尾
export const SchemaCertificateMigrateMetadataBody = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.Number(),
      nameEnc: Type.String(),
    }),
    { maxItems: 100 },
  ),
  finish: Type.Optional(Type.Boolean()),
});

export const SchemaCertificateMigrateMetadataResponse = Type.Object({
  updated: Type.Number(),
});
export type SchemaCertificateMigrateMetadataBodyType = Type.Static<
  typeof SchemaCertificateMigrateMetadataBody
>;
export type SchemaCertificateMigrateMetadataResponseType = Type.Static<
  typeof SchemaCertificateMigrateMetadataResponse
>;
export type SchemaCertificateDetailResponseType = Type.Static<
  typeof SchemaCertificateDetailResponse
>;
export type SchemaCertificateUpdateBodyType = Type.Static<
  typeof SchemaCertificateUpdateBody
>;
export type SchemaCertificateDeleteBodyType = Type.Static<
  typeof SchemaCertificateDeleteBody
>;
