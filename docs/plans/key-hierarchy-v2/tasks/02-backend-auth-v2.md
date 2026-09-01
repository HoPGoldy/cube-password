# T02: 后端 V2 认证与数据模型

## 目标

后端切换到验证者 V 模型：Prisma schema 新增 `User.keyBlob` / `User.kdfParams` / `Group.keyBlob`（预留），auth service 的 init/login/changePassword 按实施方案重写，crypto 模块删除 AES 派生路径并切到 `node:crypto`。后端零新密码学依赖。

## 上下文

- context.md 第 2、3 节；实施方案第 2.2/2.3/2.4、3、6、7 节。
- 源码：`packages/backend/src/modules/auth/service.ts`、`packages/backend/src/lib/crypto/index.ts`（含 index.test.ts）、`packages/backend/src/modules/auth/controller.ts`、`packages/backend/src/types/`（shared-types 的实体）、`packages/backend/prisma/schema.prisma`。
- 注意 challenge 机制、登录锁定、TOTP 校验、安全通知等现有行为**全部保留**，只换校验载荷。

## 边界

只允许改动：`packages/backend/**`（src、prisma、package.json 移除 crypto-js）。

## 验收

- `pnpm --filter backend test` 全绿（`lib/crypto/index.test.ts` 更新为新实现；sha512 大写 hex 输出与旧行为一致）。
- `pnpm --filter backend build` 通过。
- schema 变更可应用（按项目现状 db push 或 migrate）。

## 依赖

无（T03 依赖本任务的 `types/` 产出）。
