# Tasks

| 编号 | 名称 | 依赖 | 验证方式 |
| ---- | ---- | ---- | -------- |
| 01 | 删除防重放签名（前后端 + e2e） | - | 全量测试 + 手工确认请求无签名头可通过认证 |
| 02 | changePassword 挑战码修复（旧密码证明） | 01 | e2e change-password 用例（新增负向：无 hash / 错 hash 拒绝） |
| 03 | 删除 access-token 模块 | 01 | build 通过 + api-access-token.spec 删除后 e2e 全绿 |
| 04 | 分组锁升级 argon2id（schema + 前后端） | 01 | e2e 分组锁用例 + backend/frontend build |
| 05 | 存量分组密码迁移脚本 | 04 | 备份本地库跑脚本，旧密码逐组重设后可解锁 |
| 06 | 全量回归 | 02、03、04、05 | context.md 第 4 节全量命令 |
