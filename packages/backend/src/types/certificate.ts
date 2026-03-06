import { Type } from "typebox";

// 添加凭证
export const SchemaCertificateAddBody = Type.Object({
  name: Type.String(),
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

// 凭证详情
export const SchemaCertificateDetailBody = Type.Object({
  id: Type.Number(),
});

export const SchemaCertificateDetailResponse = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  groupId: Type.Number(),
  content: Type.String(),
  markColor: Type.Union([Type.String(), Type.Null()]),
  icon: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

// 更新凭证
export const SchemaCertificateUpdateBody = Type.Object({
  id: Type.Number(),
  name: Type.String(),
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

// 搜索
export const SchemaCertificateSearchBody = Type.Object({
  keyword: Type.Optional(Type.String()),
  markColor: Type.Optional(Type.String()),
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
  page: Type.Number({ minimum: 1, default: 1 }),
  pageSize: Type.Number({ minimum: 1, maximum: 100, default: 20 }),
});

export const SchemaCertificateSearchResponse = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.Number(),
      name: Type.String(),
      groupId: Type.Number(),
      markColor: Type.Union([Type.String(), Type.Null()]),
      icon: Type.Union([Type.String(), Type.Null()]),
      updatedAt: Type.String(),
    }),
  ),
  total: Type.Number(),
});
export type SchemaCertificateSearchBodyType = Type.Static<
  typeof SchemaCertificateSearchBody
>;
export type SchemaCertificateSearchResponseType = Type.Static<
  typeof SchemaCertificateSearchResponse
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
