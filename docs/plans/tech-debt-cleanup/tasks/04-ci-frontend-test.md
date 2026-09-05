# T04: CI 补前端测试

## 目标

frontend 的 62 个 vitest 用例（e2ee 加密核心）纳入 CI——它们是整个加密体系的安全网，目前不在 CI 里。

## 上下文

- context.md 第 1 节范围、第 2 节方案概要第 4 条。
- 文件：`.github/workflows/ci.yml` verify job，现有步骤 `pnpm lint` → `backend test` → `backend build` → `frontend build`。

## 边界

只允许改动 `.github/workflows/ci.yml`：在 backend test 之后插入 `pnpm --filter frontend test`。

## 验收

push 分支后 CI verify job 全绿。

## 依赖

无（软依赖 T01：避免删除测试时 CI 先红）。
