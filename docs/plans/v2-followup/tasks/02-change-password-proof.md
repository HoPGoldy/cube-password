# T02: changePassword 挑战码修复（旧密码证明）

## 目标

恢复 change-password 挑战码的设计意图：改密码必须证明请求者知道旧密码（context.md 决策 2），封堵"会话令牌被窃 + 未开 TOTP"场景下的改密勒索。

## 上下文

- context.md 第 2 节决策 2、第 3 节 challenge 时序约束。
- 源码：frontend `pages/change-password/content.tsx`（第①步 `deriveMasterKey` 返回的旧 verifier 当前被解构丢弃，取回）、`services/auth.ts`；backend `types/auth.ts`（change-password body schema）、`modules/auth/service.ts`（`popLastChallenge` 结果目前仅做非空检查、后续零使用——在此处插入比对）；e2e `tests/api-change-password.spec.ts`（`changePasswordViaApi` 及负向用例）。
- 校验语义照抄 login：`expectedHash = sha512(user.passwordHash + challengeCode)`。

## 边界

只允许改动上列文件；不动 challenge 机制本身（决策 3）、不动 TOTP 校验逻辑（hash 校验位置取实现简单者）、失败从简（拒绝即可，不走锁定/通知）。

## 验收

e2e change-password 用例全绿，含新增负向：不携带 hash、携带错误 hash 的请求被 401/403 拒绝，正确 hash 成功；前端输入错误旧密码仍由本地 AEAD 验证拦截（行为不变）。

## 依赖

T01（同文件多处改动，顺序执行避免冲突）。
