# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 前端即取即用改造 | - | `pnpm --filter frontend test` + grep 零残留 |
| 02 | 服务端 TTL 收紧与 e2e 补验 | 01 | `pnpm --filter backend test` + `pnpm test:e2e` |

> 两 ticket 同属一个交付批次（单 commit squash），T01 完成并验收后接 T02。
