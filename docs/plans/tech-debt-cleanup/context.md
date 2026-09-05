# 技术债清理（零行为变更）

## 1. 背景与目标

cube-password 在 v2 密钥分层改造（E2EE）后遗留了一批死代码、死依赖与配置治理问题，多数源自 cube-diary 的整体拷贝或 v1 时代的旧路径。本 PRD 一次性清扫，**不改变任何接口行为与功能语义**，为后续 PRD（`docs/plans/v2-followup/`）提供干净基线。

**范围**（已逐项确认）：

- 删除零引用死代码：`shaWithSalt`（前后端）、`backend/src/utils/tree.ts`、`backend/src/utils/vo.ts`、`backend/src/types/schema.ts` 未用 helpers、`frontend/src/types/global.ts` 未用类型；
- 删除死依赖（代码零 import）：backend `jimp` / `bcryptjs` / `axios` / `qrcode` + `@types/qrcode` / `@cacheable/node-cache`；frontend `react-helmet` / `echarts` / `@monaco-editor/react` / `monaco-editor` / `@uiw/react-md-editor` / `js-base64` / `classnames` / `react-transition-group`（含随删的 `@types/react-helmet` / `@types/react-transition-group` / `bcryptjs`）。
- 删除 AppConfig 的 NodeCache 缓存层（单用户 SQLite 直查即可，缓存已做正确失效，删除零行为差异）；
- **保留** `mockjs` 与 `/certificate/rand-name` 端点（随机用户名功能保留，不本地化实现）；
- 配置治理：`backend/.env`（含 JWT secret）与 `e2e/.env` 移出 git 追踪，补 `.env.example`；删除无代码读取的 `BACKEND_JWT_SECRET` / `BACKEND_LOGIN_PASSWORD`；
- CI 补前端测试（62 个 e2ee vitest 用例目前不在 CI 里）；
- tsconfig 收紧：frontend `strict: true` + `target` es5→ES2020，backend `noImplicitAny: true`（各仅 1 处类型错误待修）。

**非目标**：

- 不改任何 API、schema、加密行为（那些在 `docs/plans/v2-followup/`）；
- 不动 `mockjs`、分组锁、access-token 模块（access-token 的删除属于行为变更，在 v2-followup）。

## 2. 方案概要

1. **死代码**：按文件删除 + 同步删除引用它们的测试用例（`shaWithSalt` 的前后端测试段）；`unify-response` 的 `console.error(error)` 改为 `request.log.error(error)`（消除与 pino 的重复日志）。
2. **死依赖**：先删 import（NodeCache 缓存层），再 `pnpm remove`，最后全量构建验证无隐式引用。
3. **配置治理**：`git rm --cached` 保留本地文件；`.gitignore` 补 `**/.env`（example 除外）；新增 `backend/.env.example`（无 secret 默认值）；`e2e/.env.example` 已存在，顺带修正其注释中与 backend `.env` 相关的失效说明。
4. **CI**：`ci.yml` verify job 在 `pnpm --filter backend test` 后加 `pnpm --filter frontend test`。
5. **tsconfig 收紧**：frontend `strict: true` + `target` es5→ES2020，backend `noImplicitAny: true`。

## 3. 公共上下文

- 常用命令：`pnpm lint`、`pnpm --filter backend test`、`pnpm --filter frontend test`、`pnpm --filter backend build`、`pnpm --filter frontend build`、`pnpm test:e2e`。
- `sha512` 工具函数保留（防重放签名删除前仍被 `createReplayAttackHeaders` 使用；v2-followup 删除签名后自然收敛）。
- frontend `.env` / `.env.production` 不含 secret，保持 git 追踪不动。
- 已知坑：开启严格检查后当前代码各有 1 处错误——frontend `src/layouts/app-container/index.tsx` L126 null 赋值；backend `src/modules/app-config/service.ts` L34 `const configs = {}` 隐式 any（T02 顺带修复）。

## 4. 端到端验收

全部任务完成后：

```bash
pnpm lint \
  && pnpm --filter backend test \
  && pnpm --filter frontend test \
  && pnpm --filter backend build \
  && pnpm --filter frontend build \
  && pnpm test:e2e
```

全绿，且功能行为与清理前完全一致（e2e 45 用例通过、登录/增删改查凭证/改密码全流程无感知差异）。
