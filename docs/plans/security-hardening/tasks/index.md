# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 代码卫生包 | - | `pnpm --filter backend test && pnpm --filter frontend test` |
| 02 | 后端小改合集（lockType/P2003/全 POST） | - | `pnpm --filter backend test`（e2e 红属预期，T04 收口） |
| 03 | 绝对会话超时 + 前端倒计时 | - | 后端单测 + 秒级参数手动验证 |
| 04 | rand-name 前端化 + 接口适配收口 | 02 | `pnpm test:e2e` |
| 05 | CSP 上线 | 01-04 | 手动全功能 + `pnpm test:e2e` |
| 06 | 文档与版本收尾（README/死依赖/LICENSE/2.1.0） | 05 | 全量验证命令 + release |

> 全部任务同属一个交付批次（用户指定不拆 PR），按表顺序执行；01/02/03 可并行。
