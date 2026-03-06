import { Type } from "typebox";

// 通知类型枚举
export enum NoticeType {
  Info = 1,
  Warning = 2,
  Danger = 3,
}

// 通知列表请求
export const SchemaNotificationListBody = Type.Object({
  page: Type.Number({ minimum: 1, default: 1 }),
  pageSize: Type.Number({ minimum: 1, maximum: 100, default: 20 }),
  type: Type.Optional(Type.Number()),
  isRead: Type.Optional(Type.Number()),
});
export type SchemaNotificationListBodyType = Type.Static<
  typeof SchemaNotificationListBody
>;

// 通知列表响应
export const SchemaNotificationListResponse = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.Number(),
      title: Type.String(),
      content: Type.String(),
      date: Type.String(),
      type: Type.Number(),
      isRead: Type.Number(),
    }),
  ),
  total: Type.Number(),
});
export type SchemaNotificationListResponseType = Type.Static<
  typeof SchemaNotificationListResponse
>;
