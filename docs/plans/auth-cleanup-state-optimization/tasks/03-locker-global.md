# T03: LoginLocker 去 IP 化

## 目标
对齐 AGENTS.md 原则「login 失败时全局锁定」：`LoginLocker` 删除 IP 维度——`failRecords` 只存 `{ date }`，删除 `getFailCount(ip)` 的 ip 过滤，`isLocked()` 无参、用全局计数（与 `getLockDetail` 口径归一）；`recordLoginFail()` 无参。`AuthService.login` 签名去掉 `ip` 形参（controller 不再传），「密码错误」通知文案中的 `${ip}` 保留——controller 层继续读 `request.ip` 把字符串传给 `createNotice`（尽力而为的诊断信息，nginx 反代下是代理地址，已知且接受）。`SchemaLoginFailRecord` 删 `ip` 字段（`types/auth.ts`）。

## 上下文
context.md 第 2 节第 3 条；AGENTS.md Principle；源码：`packages/backend/src/lib/login-locker/index.ts` + `.test.ts`、`modules/auth/service.ts`、`modules/auth/controller.ts`、`types/auth.ts`。

## 边界
- 允许修改：上述四个文件及 login-locker 测试。
- 禁止触碰：前端（前端类型适配在 T06 一并处理，本任务后前端 `types/auth.ts` 手写的 `LockDetail` 会与 `@shared-types` 暂时字段不一致——前端这两个 interface 本就独立声明、结构兼容（多一个字段不报错），tsc 不会失败，勿动前端）。

## 验收
- `pnpm --filter backend test` 全绿（locker 测试改为全局语义用例：3 次即锁、跨"IP"累计）。
- `pnpm --filter backend exec tsc --noEmit` 零错误。
- `E2E_LOGIN_PASSWORD=admin123 pnpm test:e2e -- --grep "auth|locker|lock"`（packages/e2e 下）全绿。

## 依赖
T01（同文件 `modules/auth/service.ts`，在其之后串行避免编辑冲突）
