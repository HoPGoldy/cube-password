# T01: challenge 单槽位 + 静默拒绝 + login 先查锁再 pop

## 目标
`ChallengeManager` 从 Map 简化为全局单槽位（一个 code + createdAt，`generateChallenge` 即覆盖，pop 即清空，保留 TTL 过期判定），删除遍历扫描逻辑；`AuthService.login` 校验次序改为先查锁再 pop（锁定期间请求不烧码不翻新码）；pop 失败改为**静默拒绝**——删除"非法登录" `createNotice` 调用与失败计数，仅抛 `ErrorUnauthorized`。otp/remove 的回传校验模式保持现状不动。行为变更的依据见 context.md 第 2 节第 1 条（D2 决策：静默拒绝是「泄露探测器」语义的一部分——密码错误才告警）。

## 上下文
context.md 全文；源码：`packages/backend/src/lib/challenge/index.ts`（及其 test）、`packages/backend/src/modules/auth/service.ts`（login 方法）、`packages/backend/src/modules/otp/service.ts`（只读参考，勿改）、AGENTS.md 的 Glossary「挑战码」词条。

## 边界
- 允许修改：`lib/challenge/index.ts` + 其 `.test.ts`、`modules/auth/service.ts`（login 方法内 challenge/锁定次序与通知逻辑）。
- 禁止触碰：otp 模块、`login-locker`（T03 处理）、前端、challenge 相关 e2e fixtures 的对外签名（`queryChallenge` 契约不变）。

## 验收
- `pnpm --filter backend test` 全绿（challenge test 需覆盖：单槽位覆盖、过期、pop 后为空）。
- `pnpm --filter backend exec tsc --noEmit` 零错误。
- `E2E_LOGIN_PASSWORD=admin123 pnpm test:e2e -- --grep "auth|password|otp"`（在 packages/e2e 下）全绿。

## 依赖
无
