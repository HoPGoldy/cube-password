# V2 收尾（v1 遗留清理与认证栈简化）

## 1. 背景与目标

v2 密钥分层改造（`docs/plans/key-hierarchy-v2/`）解决了核心加密问题，但留下几处"半成品"：防重放签名形同虚设、changePassword 的挑战码被架空、分组锁密码仍是 v1 弱哈希、access-token 模块经评估无业务价值。本 PRD 在 PRD-1（`docs/plans/tech-debt-cleanup/`）的干净基线上收尾，**允许改变接口与行为**（单用户自部署无兼容包袱）。

**非目标**（讨论中已明确否决/暂缓，实施时不得反复）：

- 分组独立加密（组 DEK）：已设计、暂缓实施，`Group.keyBlob` 为其预留列，**保留不写入不删除**，仅更新注释为"预留：分组独立加密（规划中）"；
- 无状态挑战码：已否决，`BACKEND_JWT_SECRET` 已随 PRD-1 删除；
- 登录响应瘦身、group/certificate API 风格统一（删 access-token 后全库自然只剩动词式风格）；
- Totp 分组锁任何改动：价值在遗忘恢复（密码会忘，TOTP 不会），与 Password 锁互补，保留；
- login-locker、SessionManager 单会话模型不动。

## 2. 方案概要（已敲定决策）

1. **删除防重放签名**：前后端签名逻辑、session 的 `replayAttackSecret`、login 响应字段、e2e 签名头全部移除。理由：现状三个 header 缺一即跳过校验（形同虚设）；重放在 E2EE 架构下收益极低（重放读拿到密文，写操作有 challenge/TOTP 把关）；非 HMAC 强度存疑（challenge-mechanism-review P5）。认证栈收敛为三层：session token（会话）+ challenge（密码证明）+ TOTP（敏感操作）。
2. **changePassword 的挑战码由"架空"修复为"真实校验"**：恢复设计意图——改密码必须证明旧密码，校验语义与 login 完全同构（`SHA512(hex(V_old) + challenge)` 比对库存 V）。前端零额外成本：改密码流程本地验旧密码时 KDF 已同时算出旧 V，当前被解构丢弃，取回即可。修复封闭场景：会话令牌被窃 + 未开 TOTP 时攻击者可改密码锁死 owner（勒索），修复后降级为只能读未锁分组密文。
3. **登录 / 分组解锁的挑战码机制保持现状**：`popLastChallenge` 服务端弹最新 + hash 密学比对，单用户前提下并发竞争不存在（challenge-mechanism-review P1/P2 维持"可接受、不修"）。
4. **分组锁密码升级 argon2id**：分组锁是永久门禁（见非目标第一条），门禁就该牢固——v1 的 `sha512(salt+pwd)` 可被 GPU 秒破。升级为与主密码同构的 KDF 体系：`deriveMasterKey`（复用前端 e2ee core）→ 存 verifier V + salt + kdfParams（Group 表加列），unlock 用 `SHA512(hex(V)+challenge)` 比对。存量 v1 分组密码用一次性脚本迁移（逐组输入旧密码重新派生，服务端无法从 sha512 推回明文）。解锁约 0.5s KDF 延迟为预期行为。
5. **删除 access-token 模块**：owner 确认无使用方；解密依赖主密码，token 会话只能操作密文元数据，业务价值不成立；且它是系统唯一绕过主密码的永久会话入口（完整性威胁）。删除后 API 风格自然统一。

## 3. 公共上下文

- 前置：PRD-1 已合入（干净基线、`sha512` 工具收敛、strict 已开）。
- 技术栈与常用命令同 `docs/plans/key-hierarchy-v2/context.md` 第 3 节：backend（Fastify + Prisma + SQLite）、frontend（React 18 + jotai + react-query）、e2e（Playwright，45 用例基线）。
- e2e 公共影响面：`fixtures/api.ts` 的 `SessionInfo` 去掉 `replayAttackSecret`、`authHeaders` 只留 `X-Session-Token`；`changePasswordViaApi` 增加 hash 计算；分组锁用例改用 e2ee core 派生。T01 完成后所有 spec 的签名引用即失效，须同步。
- challenge 时序约束（保持现状的机制）：登录/解锁的 challenge 请求必须是紧邻的前一次请求（服务端 pop 最新），前端调用点与 e2e 保持该顺序。
- 数据库迁移遵循现状（`prisma migrate dev`，见 `packages/backend/prisma/migrations/`）。
- migration 与一次性脚本的关系：schema 加列随 T04 正常 migration；存量**数据**升级走 T05 脚本（服务端无明文，只能 owner 逐组输密码重派生）。

## 4. 端到端验收

完成定义：全新库 init → 登录（无任何签名头）→ 创建 Password 锁分组（v2 派生落库，kdfParams 非空）→ 解锁该分组（约 0.5s）→ 正确密码成功 / 错误密码失败 → 改密码：无旧密码证明或错误 hash 被拒绝、正确 hash 成功 → access-token 接口全部 404 → 数据库无 AccessToken 表。

```bash
pnpm lint \
  && pnpm --filter backend test \
  && pnpm --filter frontend test \
  && pnpm --filter backend build \
  && pnpm --filter frontend build \
  && pnpm test:e2e
```
