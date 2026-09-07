# T01: 后端数据层与接口改造

## 目标

schema 加 `nameEnc` 与 `metadataVersion`、凭证读写接口切换为透传密文、删除
`certificate/search` 接口。为什么：让服务端对凭证名称零知识，这是元数据加密的
数据层地基。前端行为本任务不碰（改完前端会红，T02 收口）。

## 上下文

- context.md 第 2.1、2.2 条与"本计划关键文件"前三行。
- 必读源码：`backend/prisma/schema.prisma`、`backend/src/modules/certificate/{controller,service}.ts`
  （search 在 service.ts 的 search 方法 + controller 路由）、`backend/src/types/certificate.ts`
  （schema 定义与 @shared-types 联动）、`backend/src/modules/auth/service.ts`
  （login 响应补 metadataVersion）、现有 migration 的写法（`prisma/migrations/`）。

## 边界

- `backend/prisma/schema.prisma` + 新增 migration 文件
- `backend/src/modules/certificate/**`、`backend/src/types/certificate.ts`
- `backend/src/modules/auth/service.ts`（login 响应加一个字段）
- 新增迁移数据接口：`certificate/migrate-metadata`（批量写 nameEnc + 收尾写
  metadataVersion，单事务、单批上限 100 条），controller/service/types 自行按现有
  module 四件套风格组织。

## 验收

- `pnpm --filter backend test` 全绿；新增单测：migrate-metadata 接口的事务性
  （部分失败整批不落库）、批量上限拒绝、metadataVersion 收尾写入。
- `grep -rn "search" backend/src/modules/certificate/` 仅剩注释或零命中。
- `pnpm --filter backend build` 通过；`prisma migrate dev` 生成迁移无手工编辑痕迹。

## 依赖

无（PRD ① 可独立合并；T02 依赖本任务产出接口）。
