# T03: 配置治理

## 目标

敏感配置移出 git 追踪，删除无代码读取的死配置项（`BACKEND_JWT_SECRET` / `BACKEND_LOGIN_PASSWORD`，全库零读取）。

## 上下文

- context.md 第 1 节范围、第 2 节方案概要第 3 条。
- 文件：`packages/backend/.env`（含真实 secret，被 git 追踪）、`packages/e2e/.env`（同被追踪）、`packages/e2e/.env.example`（注释引用了将删除的配置，需同步）、frontend `.env*`（无 secret，不动）。
- `packages/backend/src/lib/swagger/index.ts` 的 `securitySchemes` 与实际认证方式不符，本任务只记录不改（PRD-2 T01 处理）。

## 边界

允许改动：git 索引（`git rm --cached` 两个 .env，本地文件保留）、`.gitignore`、新增 `packages/backend/.env.example`（无 secret 默认值）、两个 `.env` 删死配置行、`e2e/.env.example` 注释修正。不动任何源码。

## 验收

`git status` 不再显示这两个 `.env`；后端无环境变量时可正常启动（默认值 fallback 生效）；`pnpm test:e2e` 全量通过（global-setup 不依赖被删配置）。

## 依赖

无。
