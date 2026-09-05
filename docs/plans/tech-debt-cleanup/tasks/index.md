# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 死代码删除 | - | `pnpm --filter backend test && pnpm --filter frontend test` |
| 02 | 死依赖与 NodeCache 删除 | 01 | `pnpm --filter backend build && pnpm --filter frontend build` |
| 03 | 配置治理（.env 出库 + 死配置删除） | - | `git status` 确认 .env 不再追踪、backend 可用 `.env.example` 说明的默认值启动 |
| 04 | CI 补前端测试 | 01 | push 后 CI verify job 包含 frontend test |
| 05 | tsconfig 收紧 | 01、02 | `pnpm --filter backend build && pnpm --filter frontend build && pnpm lint` |
| 06 | 全量回归 | 02、03、04、05 | 第 4 节全量命令 + `pnpm test:e2e` |
