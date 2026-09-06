# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | challenge 单槽位 + 静默拒绝 + locker 先查锁 | - | backend vitest + tsc + e2e auth/change-password/otp 相关 spec |
| 02 | 分组锁定写操作门禁 | - | e2e 新增 group-write-gate spec |
| 03 | LoginLocker 去 IP 化 | 01（同文件 auth/service.ts，避免冲突） | backend vitest（login-locker.test 更新）+ tsc + e2e |
| 04 | index.html 内存副本注入 | - | 生产模式 curl 冒烟（见 context.md 第 4 节） |
| 05 | packages/shared kdf-params 合并 | - | 双端 tsc + backend vitest（kdf-params.test 迁移）+ e2e |
| 06 | 前端分组状态拆分 react-query/jotai | 02、03（group list 响应结构变更后做） | frontend tsc + e2e 全量（UI 路径） |
| 07 | 遗留清理与杂项打包 | 01-06 全部完成后（纯删除，避免与功能改动交叠） | lint + 双端 tsc + 双端 build + e2e 全量 |
| 08 | 最终回归 | 01-07 | context.md 第 4 节全量验收 |

注意：e2e 依赖 dev 库密码。playwright global-setup 在库未初始化时会用 `E2E_LOGIN_PASSWORD` 自动 init；当前 `packages/backend/storage/main.db` 已初始化且密码为 `admin123`。执行 e2e 前设置 `E2E_LOGIN_PASSWORD=admin123`，或用 `pnpm init:dev` 重建库后保持默认 `admin`。两个方案任选其一，但同一轮 e2e 内不得混用。
