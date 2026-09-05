# T01: 删除防重放签名

## 目标

移除形同虚设的防重放签名机制，认证栈收敛为 session token + challenge + TOTP 三层（context.md 决策 1）。并修正 swagger 的 securitySchemes（bearer/JWT 与实际 `x-session-token` 认证不符）。

## 上下文

- context.md 第 2 节决策 1、第 3 节 e2e 公共影响面。
- 源码：backend `modules/auth/controller.ts`（preHandler 签名校验段）、`lib/crypto/index.ts`（`validateReplayAttack` 及测试）、`lib/session/index.ts`（`UserSession.replayAttackSecret`）、`modules/auth/service.ts` 与 `types/auth.ts`（login 响应字段）、`lib/swagger/index.ts`；frontend `utils/crypto.ts`（`createReplayAttackHeaders`）、`services/base.ts`（拦截器签名段）、`store/user.ts`（`stateReplayAttackSecret`）；e2e `fixtures/api.ts`（`createReplayHeaders`/`authHeaders`/`SessionInfo`）、`global-setup.ts`（无签名逻辑，确认不动）。
- 现状缺陷细节：preHandler `if (nonce && timestamp && signature)` 缺任一 header 即跳过校验。
- access-token 模块的 `replayAttackSecret` 本任务不处理（T03 随模块整体删除，避免中间态 broken）。

## 边界

只允许改动上列签名相关代码；不动 session token 校验、challenge、TOTP、login-locker。

## 验收

`pnpm --filter backend test && pnpm --filter frontend test && pnpm test:e2e` 全绿；手工 curl 带任意/不带签名头访问受保护接口，行为与只带 token 一致；swagger 文档展示的认证方式与实际一致。

## 依赖

PRD-1 全部完成（基线）。
