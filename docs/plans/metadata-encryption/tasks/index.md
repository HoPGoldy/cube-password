# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 后端数据层与接口改造（nameEnc/metadataVersion/删 search/迁移接口） | - | `pnpm --filter backend test && pnpm --filter backend build` |
| 02 | 前端索引、本地搜索与存量迁移 | 01 | 手动全流程 + `pnpm test:e2e` |

> 前置：security-hardening 批次（2.1.0）先合入。本计划两个任务即用户指定的两个 PRD。
