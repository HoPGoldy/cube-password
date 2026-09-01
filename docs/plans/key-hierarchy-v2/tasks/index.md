# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 前端 e2ee 核心模块 | - | `pnpm --filter frontend test` |
| 02 | 后端 V2 认证与数据模型 | - | `pnpm --filter backend test && pnpm --filter backend build` |
| 03 | 前端运行时切换 e2ee | 01、02（类型） | `pnpm --filter frontend build && pnpm lint` |
| 04 | v1→v2 迁移脚本 | 01、02 | 构造 v1 库跑脚本并用 e2ee 模块验证可解 |
| 05 | e2e 适配与全量收尾 | 03、04 | `pnpm test:e2e` + 全量验证命令 |
