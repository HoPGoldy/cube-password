# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 后端移除异地检测/登录 TOTP/ip-location/login-locker location | - | `pnpm --filter backend exec vitest run` + `pnpm --filter backend build` |
| 02 | 删 commonLocation 列 migration + 删 xdb/Dockerfile | 01 | `pnpm --filter backend exec prisma migrate dev` 成功 + grep 无残留 |
| 03 | 前端登录页去 TOTP、失败记录改展示 IP | 01 | `pnpm --filter frontend build` + `pnpm lint` |
| 04 | 回写决策文档 ip-location-removal.md + 全仓残留检查 | 01, 02, 03 | 端到端验收命令全绿 |
