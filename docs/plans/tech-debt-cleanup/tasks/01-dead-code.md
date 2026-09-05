# T01: 死代码删除

## 目标

删除零引用的死代码及其测试，不改变任何运行时行为。死代码清单已在讨论中逐项经全库 grep 确认。

## 上下文

- context.md 第 1 节范围与第 2 节方案概要第 1 条。
- 源码：`packages/backend/src/lib/crypto/index.ts`（及 index.test.ts）、`packages/frontend/src/utils/crypto.ts`（及 crypto.test.ts）、`packages/backend/src/utils/{tree,vo}.ts`、`packages/backend/src/types/schema.ts`、`packages/frontend/src/types/global.ts`、`packages/backend/src/lib/unify-response/index.ts`。
- 零引用确认结论：`shaWithSalt`（前后端）仅测试引用；`tree.ts`/`vo.ts`/schema helpers/`AppListResponse` 等类型整块零引用。
- `sha512` 工具必须保留（防重放签名删除前仍被 `createReplayAttackHeaders` 使用）。

## 边界

只允许改动上述文件（删除条目及其 import、对应测试用例）；`unify-response` 的 `console.error(error)` 改为 `request.log.error(error)`。不碰任何业务逻辑、接口、schema。

## 验收

`pnpm --filter backend test && pnpm --filter frontend test` 全绿；`pnpm lint` 无 unused 报错；`pnpm --filter backend build && pnpm --filter frontend build` 通过。

## 依赖

无。
