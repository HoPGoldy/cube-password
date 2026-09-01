# T02: 删除 commonLocation 列（migration）+ 清理 xdb 资源与 Dockerfile

## 目标

数据库层面删除已无人读写的 `User.commonLocation` 列，并清理 ip2region 的物理资源：xdb 数据文件与 Dockerfile 中的专用 COPY。

## 上下文

- 读 `docs/plans/ip-location-removal/context.md` 第 2、3 节。
- 需要阅读：
  - `packages/backend/prisma/schema.prisma`（`commonLocation String @default("")`）
  - `packages/backend/prisma/migrations/`（参考已有 migration 命名风格，如 `20260305000001_remove_tag_model`）
  - `Dockerfile`（第 39 行附近 `COPY packages/backend/resources/ip2region.xdb ...`）
- T01 已移除后端代码对 `commonLocation` 的全部引用，本 Ticket 不会再引起类型错误。

## 边界

只允许修改/删除：

- `packages/backend/prisma/schema.prisma`：删 `commonLocation` 字段。
- `packages/backend/prisma/migrations/`：用 `pnpm --filter backend exec prisma migrate dev --name remove_common_location` 生成 migration（SQLite，本地 dev 库可直接 apply）。
- 删除 `packages/backend/resources/ip2region.xdb`。
- `Dockerfile`：删 xdb 的 COPY 行。

不改其他任何文件。

## 验收

```bash
cd cube-password
pnpm --filter backend exec prisma migrate dev   # 成功 apply，无 drift 报错
pnpm --filter backend exec vitest run           # 仍全绿
pnpm --filter backend build                     # 生成物更新后 tsc 仍通过
grep -rn "commonLocation" packages/backend/src packages/backend/prisma/schema.prisma  # 应为空
grep -n "ip2region" Dockerfile                  # 应为空
ls packages/backend/resources/ip2region.xdb     # 应不存在
```

## 依赖

T01（依赖其产出：后端代码不再引用 `commonLocation`）。
