# 移除 ip2region 地理转译与异地登录检测

## 1. 背景与目标

`resources/ip2region.xdb` 占 10.6MB，Dockerfile 有专门 COPY 逻辑，地理转译结果经常不准，对个人自部署场景价值低。本次改造将其整体移除，并顺带简化安全模型。

**目标：**

1. 整体移除 ip2region 地理转译（库、数据文件、Dockerfile COPY、配置项）；
2. 「异地登录检测」整个移除（原方案 A 的 IP 直比也放弃，采用方案 B）；
3. 登录环节的 TOTP 校验随检测一并移除（它原本只在异地分支触发）；TOTP 继续服务于分组解锁与改密；
4. `User.commonLocation` 字段通过 migration 删列；
5. 登录失败记录（LoginFailRecord）删除 `location` 字段，前端改展示已有的 `ip` 字段。

**非目标（明确不动）：** TOTP 分组解锁（`lockType === "Totp"`）、改密时的 TOTP 密钥派生、OTP 绑定/解绑模块、登录失败锁定机制（一天 3 次）、challenge 机制。

## 2. 方案概要（关键决策）

1. **异地检测整个删除，登录成功完全无通知**。已确认接受：单用户自部署场景，成功登录通知信噪比低；失败仍有通知 + 锁定兜底。
2. **登录 TOTP 删除而非改为必填**。TOTP 的设计重心是分组级保护；攻击者即便拿到主密码登录，也解不开 Totp 锁定分组。
3. **`commonLocation` 直接删列**。该字段无前端/API/其他模块暴露，僵尸列无保留价值；项目用 `prisma migrate` 规范管理。
4. **失败记录的 `location` 字段删除而非改存 IP**。记录里本就有独立的 `ip` 字段，location 存 IP 是纯冗余；前端改动仅一个字段名。
5. **安全审计只记录原始事实（IP），不做不可靠的派生转译**；登录失败/非法登录通知保留，文案只含 IP。

## 3. 公共上下文

技术栈与结构（pnpm workspace）：

- `packages/backend`：Fastify + Prisma（SQLite，`prisma migrate`）+ vitest。测试 `pnpm --filter backend test`（vitest，非 watch 模式用 `vitest run`），构建 `pnpm --filter backend build`（tsc + pkgroll）。
- `packages/frontend`：React + antd + jotai + react-query，构建 `pnpm --filter frontend build`（tsc && vite build）。
- 根目录 lint：`pnpm lint`（eslint）。
- e2e：`pnpm test:e2e`，已确认不依赖 location/ip2region，无需改动。

关键代码事实（已核实）：

- `lib/ip-location` 仅被 `modules/auth/service.ts` 引用（`queryIp`/`isSameLocation`/`formatLocation`，共 6 处调用）。
- 异地检测分支位于 `auth/service.ts` login() 内：`queryIp` → `isSameLocation` → 无 TOTP 发通知 / 有 TOTP 抛 `ErrorNeedTotpCode` 或校验动态码。
- 登录成功后在 `auth/service.ts:186` 附近更新 `commonLocation`，本次一并删除。
- `ErrorNeedTotpCode` 定义于 `modules/auth/error.ts`，HTTP 错误码 **40103**，前端登录页凭 `resp.code === 40103` 弹动态码输入。该错误码随本次改造退役。
- 登录请求体 `code` 参数定义于 `types/auth.ts`（"TOTP code for remote login"），一并删除。
- `withTotp` 登录响应字段**保留**：前端分组配置、OTP 绑定页、改密页均依赖。
- `login-locker/index.ts`：`LoginFailRecord { ip, date, location }`，`recordLoginFail(ip, location)`；测试在 `login-locker/index.test.ts`。
- 前端失败记录展示：`pages/login/page.tsx` 的 `renderLoginFailure`，`"于 " + item.location + " 登录失败"` → 改用 `item.ip`。
- 改密页的 TOTP（`change-password/content.tsx`、后端 `auth/service.ts` 改密分支的 `generateSync`）**不动**。

## 4. 端到端验收

整体完成定义：仓库中不再存在 ip2region / commonLocation / 异地检测 / 登录 TOTP 的任何引用，后端测试与前后端构建全部通过，migration 可正常 apply。

```bash
cd cube-password
# 无残留引用（除 docs/ 历史文档与 prisma/client 生成物外应为空）
grep -rn "ip2region\|ip-location\|commonLocation\|isSameLocation\|formatLocation\|NeedTotpCode\|40103" \
  packages/backend/src packages/frontend/src Dockerfile packages/backend/prisma/schema.prisma
# 后端单测
pnpm --filter backend exec vitest run
# 前后端构建
pnpm --filter backend build && pnpm --filter frontend build
# lint
pnpm lint
```
