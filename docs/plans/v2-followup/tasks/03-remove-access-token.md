# T03: 删除 access-token 模块

## 目标

整体移除 access-token 功能（context.md 决策 5：无使用方、无业务价值、唯一绕过主密码的永久会话入口）。删除后全库 API 风格自然统一为动词式 POST。

## 上下文

- context.md 第 2 节决策 5。
- 范围：backend `src/modules/access-token/`、`src/types/access-token.ts`、`src/app/register-service.ts` 注册项、`prisma/schema.prisma` 的 `model AccessToken`（migration drop table）；frontend `src/pages/access-token/`（孤儿页面：route.tsx 无路由、菜单无入口、零引用）、`src/services/access-token.ts`；e2e `tests/api-access-token.spec.ts`。
- `SessionManager` 不动（exchange 删除后仅 login 创建会话）。

## 边界

只允许改动上列范围；不动其他模块。

## 验收

`pnpm --filter backend build && pnpm --filter frontend build` 通过；`pnpm test:e2e` 全绿（用例数 45 → 38）；migration 后 AccessToken 表不存在，受保护接口正常。

## 依赖

T01（exchange 响应含 `replayAttackSecret`）。
