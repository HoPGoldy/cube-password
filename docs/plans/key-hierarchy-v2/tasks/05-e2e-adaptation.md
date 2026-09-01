# T05: e2e 适配与全量收尾

## 目标

e2e（Playwright）适配 V2 认证流程并做全量收尾：`global-setup.ts` 与 `fixtures/api.ts` 里硬编码的 v1 SHA512 派生/登录流程改为 argon2id + `SHA512(V + challenge)`（`hash-wasm` 在 Node 可直接运行）；涉及创建凭证的 fixture 改为 v2 密文格式；修正所有受影响 spec。收尾检查：实施方案与实际行为一致、无遗留 v1 路径。

## 上下文

- context.md 全文；实施方案第 2、4、9、10 节。
- 源码：`packages/e2e/**`（重点 `global-setup.ts`、`fixtures/api.ts`、`tests/api-auth.spec.ts`、`tests/auth.spec.ts`、`tests/api-group-certificate.spec.ts`）。
- 注意登录锁定：失败登录按 IP 计数，测试设计避免误触发（参考 global-setup 现有注释）。

## 边界

只允许改动：`packages/e2e/**`（如确需 package.json 加 `hash-wasm` 依赖允许）。

## 验收

- `pnpm test:e2e` 全绿（含 init → 登录 → 凭证 CRUD → 改密码 → 新密码重登录链路）。
- 全量验证：`pnpm --filter frontend test && pnpm --filter backend test && pnpm --filter frontend build && pnpm --filter backend build && pnpm lint` 全部通过。

## 依赖

T03（前端运行时）、T04 可并行但建议完成后一起跑全量。
