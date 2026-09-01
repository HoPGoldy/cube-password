# T01: 后端移除异地检测、登录 TOTP、ip-location、login-locker location 字段

## 目标

按方案 B+ 改造后端登录链路：删除整个异地登录检测分支（含其中只在该分支触发的 TOTP 校验）、删除 ip-location 库及其引用、login-locker 的失败记录删除冗余的 `location` 字段。不改 TOTP 分组解锁、改密、OTP 绑定/解绑、失败锁定、challenge 机制。

## 上下文

- 读 `docs/plans/ip-location-removal/context.md` 全文（重点第 2、3 节）。
- 需要阅读的源码：
  - `packages/backend/src/modules/auth/service.ts`（login() 全文）
  - `packages/backend/src/modules/auth/error.ts`（`ErrorNeedTotpCode`）
  - `packages/backend/src/types/auth.ts`（登录请求 `code` 参数）
  - `packages/backend/src/lib/login-locker/index.ts` 与 `index.test.ts`
  - `packages/backend/src/lib/ip-location/`（待删）
  - `packages/backend/src/config/path.ts`（`PATH_IP2REGION`）

## 边界

只允许修改/删除 `packages/backend/` 下的文件。具体：

- `modules/auth/service.ts`：删异地检测整段（含 TOTP 校验与 `ErrorNeedTotpCode` 抛出）；删登录成功后的 `commonLocation` 更新；两处 `recordLoginFail(ip, formatLocation(...))` 改为 `recordLoginFail(ip)`；"密码错误"通知文案去掉 `formatLocation` 部分只留 `${ip}`；清理不再使用的 import。
- `modules/auth/error.ts`：删 `ErrorNeedTotpCode`（含 40103 错误码）；若有其他模块引用需一并清理（预期无）。
- `types/auth.ts`：删登录请求的 `code` 参数。
- `lib/login-locker/index.ts`：`LoginFailRecord` 删 `location`，`recordLoginFail(ip)` 签名简化。
- `lib/login-locker/index.test.ts`：同步更新。
- 删除 `lib/ip-location/` 整个目录。
- `config/path.ts`：删 `PATH_IP2REGION`。
- **不要**动 `schema.prisma`、migration、Dockerfile、前端（属后续 Ticket）。

## 验收

```bash
cd cube-password
pnpm --filter backend exec vitest run   # 全绿
pnpm --filter backend build             # tsc 无类型错误
grep -rn "ip-location\|ip2region\|queryIp\|isSameLocation\|formatLocation\|NeedTotpCode\|commonLocation" packages/backend/src  # 应为空
```

注意：`commonLocation` 在 `prisma/client` 生成物中仍存在是正常的（T02 才改 schema），grep 范围限 `src/`。

## 依赖

无。
