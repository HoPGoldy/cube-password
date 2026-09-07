# T02: device 模块接口 + 门禁 preHandler

## 目标
新建 `packages/backend/src/modules/device/`（service/controller/error/types），实现 5 个端点（challenge/verify/add/list/revoke）与 gate token manager（内存态 10min TTL），并把门禁 preHandler 接进 `register-service`：门生效时未带有效 gate token 的预登录路由一律 403。这是整个特性的安全核心。

## 上下文
context.md 第 2 节（决策 4、5、6）、3.3（接口契约与 ieee-p1363 验签）、3.5（门禁强制点与 hook 顺序）、3.6（通知去重与单测边界）。
阅读源码：`docs/how-to-build-a-new-module.md`、`modules/auth/controller.ts`（preHandler hook 与 disableAuth 机制）、`lib/session/index.ts`（内存 manager 风格）、`app/register-service.ts`（DI 组装点）、`types/error.ts`、`spike/verify-demo.mjs`（验签参考实现，已跨端验证）。
验签用 `node:crypto` 原生 `verify` + `dsaEncoding: 'ieee-p1363'`，零新依赖。

## 边界
允许新增：`modules/device/` 全部文件、`lib/gate-token/`；允许修改：`app/register-service.ts`（注册）。禁止改动 auth/challenge/login-locker 现有逻辑，禁止新增 npm 依赖。

## 验收
`pnpm --filter backend test` 通过，用 fastify `inject` 覆盖：门未激活时 auth/global 照常 200；门生效时 auth/global/challenge/login 无 token 得 403、带有效 token 得原响应；gate token 过期/伪造拒绝；用 `node:crypto` 生成 P-256 测试向量验证 verify 通过/篡改签名 403（参照 spike 自测）；两次敲门仅 1 条 Warning 通知。`pnpm --filter backend build` 无类型错误。

## 依赖
T01（device-store 与 device-key 的接口）
