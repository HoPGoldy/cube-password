# 密钥分层 V2（E2EE 改造）

## 1. 背景与目标

cube-password 当前是单层密钥模型：主密码经 MD5/SHA256 直接派生 AES key/iv 加密凭证，SHA512 存密码哈希。存在五个缺陷：无 KDF（拖库可离线秒破）、无 DEK 层（改密码 O(n) 重加密且明文密码传后端）、IV 确定性（同明文同密文）、无认证加密（密文可静默篡改）、分组锁只是 session 门禁。

目标：按 Bitwarden 标准模型改造为 `argon2id → (KEK, V) → keyBlob → DEK → AES-256-GCM` 的密钥分层结构，修复前四个缺陷。

**非目标**（明确不做）：

- 不做方案 B（每分组 DEK 真隔离），仅在 schema 预留 `Group.keyBlob` 字段；
- 不做应用内数据迁移（V2 是破坏性更新），只交付一次性迁移脚本 + 差异文档；
- 分组门禁逻辑、TOTP、登录锁定、防重放机制全部保持现状。

**唯一事实来源**：[`docs/key-hierarchy-v2-implementation.md`](../../key-hierarchy-v2-implementation.md)（下称"实施方案"）。本文件只做任务拆分与公共上下文，设计细节与密码学流程以实施方案为准，冲突时以实施方案为准。

## 2. 方案概要（已敲定决策）

1. **KDF 只在前端**：argon2id（`hash-wasm`，m=64MiB/t=2/p=1，salt 32B 前端生成）输出 64B，前 32B=KEK（仅内存），后 32B=验证者 V（hex 存 `User.passwordHash`）。后端零新密码学依赖，登录校验沿用 `SHA512(V + challenge)` 模式。
2. **全局 DEK**：随机 32B，以 `keyBlob = AES-256-GCM(KEK, DEK)` 存库；凭证 content 用 DEK + 随机 nonce 加密，v2 自描述格式：`v2:aes-256-gcm:<nonce_hex>:<ciphertext_hex>:<tag_hex>`。
3. **改密码 = O(1) re-wrap**：前端本地用 oldKEK 解 keyBlob 验旧密码（AEAD tag 即认证），新 KEK 重包裹 DEK 提交；后端校验 session+challenge+TOTP 后更新三字段，**不销毁 session**。
4. **强度校验**：`@zxcvbn-ts/core` 懒加载，评分 < 3 警告不拦截（init / 改密码页）。
5. **迁移**：一次性脚本 `scripts/migrate-v1-to-v2.mjs`（自动备份原库、脏数据跳过、单事务写回），用完即弃。

## 3. 公共上下文

### 技术栈与结构

- pnpm monorepo：`packages/backend`（Fastify + Prisma + SQLite，vitest）、`packages/frontend`（React 18 + antd 5 + jotai + react-query，Vite，**目前无测试 runner**）、`packages/e2e`（Playwright）。
- `@shared-types/*` 是 frontend tsconfig 里指向 `backend/src/types/*` 的路径别名，**不是独立 package**。
- 常用命令：
  - 后端测试/构建：`pnpm --filter backend test` / `pnpm --filter backend build`
  - 前端构建（含 typecheck）：`pnpm --filter frontend build`
  - e2e：`pnpm test:e2e`（需先起服务，见 e2e/global-setup.ts）
  - 全仓 lint：`pnpm lint`
- 后端源码别名 `@/` 指向 `backend/src/`。

### 现状关键文件（改造前必读）

| 关注点 | 文件 |
|--------|------|
| 旧密码学实现（前后端各一份） | `packages/backend/src/lib/crypto/index.ts`、`packages/frontend/src/utils/crypto.ts` |
| 认证服务（init/login/changePassword） | `packages/backend/src/modules/auth/service.ts` |
| 数据模型 | `packages/backend/prisma/schema.prisma` |
| 前端用户状态（stateMainPwd 等） | `packages/frontend/src/store/user.ts` |
| 登录/初始化/改密码页 | `packages/frontend/src/pages/{login,init,change-password}/` |
| 凭证加解密调用点 | `packages/frontend/src/pages/certificate-list/components/certificate-detail.tsx` |
| 后端 crypto 单测 | `packages/backend/src/lib/crypto/index.test.ts` |

### 约定与坑

- **API 响应**统一 `{ success, code, data, message? }` 包装，前端 service 层已封装。
- **challenge 机制**：`/api/auth/challenge` 取挑战码，后端 `popLastChallenge()` 单次消费；登录/分组解锁/改密码都要先取。login 校验的是 `SHA512(storedHash + challenge)`。
- **防重放 header**：`X-Timestamp/X-Nonce/X-Signature`，签名 = `SHA512(url+nonce+timestamp+secretKey)`，前端 `createReplayAttackHeaders`、后端 `validateReplayAttack`，本次保留但必须随 crypto 库切换一起迁移（两边 SHA512 输出必须一致，大写 hex）。
- **单 session**：`SessionManager` 单会话模型；登录失败锁定按 IP 计数（e2e 里小心触发锁定，参见 global-setup 注释"只探测 1 次"）。
- **前端无测试 runner**：T01 需引入 vitest（devDependency），e2ee 模块必须配单测。
- **e2e global-setup 硬编码了 v1 登录流程**（node:crypto 算 SHA512 直连后端），T05 要重写为 argon2id 流程（`hash-wasm` 在 Node 可直接运行）。
- **schema 变更**：本项目用 `prisma db push` 还是 migrate，开工时看 `packages/backend/prisma/` 与 package.json scripts 确认，遵循现状。
- CryptoJS 在两端最终都要移除；`sha512` 前端换 `@noble/hashes`、后端换 `node:crypto`。

## 4. 端到端验收

完成定义：全新环境 init 设置主密码（有 zxcvbn 提示）→ 登录（argon2id 派生）→ 增删改查凭证（v2 密文落库）→ 改密码后不重新登录继续操作 → 重新登录新密码生效旧密码失效 → 数据库里无任何明文/key 材料，content 全部为 `v2:` 前缀。

```bash
pnpm --filter frontend test && pnpm --filter backend test \
  && pnpm --filter frontend build && pnpm --filter backend build \
  && pnpm lint && pnpm test:e2e
```
