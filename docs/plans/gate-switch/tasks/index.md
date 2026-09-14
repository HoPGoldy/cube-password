# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 后端判定改造 + 开关接口 | - | `pnpm --filter backend test` |
| 02 | 前端设备管理页开关化 | 01 | `pnpm --filter frontend test` + 手动冒烟 |
| 03 | e2e 适配 + 全链路用例 + 文档收尾 | 01,02 | `pnpm test:e2e` 全量 |

> 单批次交付，最终 squash 为一个 commit。
