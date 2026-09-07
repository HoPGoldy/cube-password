# 元数据加密（凭证名称 E2EE 化 + 前端本地搜索）

## 1. 背景与目标

当前凭证名称 `Certificate.name` 明文落库，为的是服务端 SQL 搜索（`name contains
keyword`）。代价：拖库者虽解不开密码字段（content 已 E2EE），但能看到完整账号清单
（"招商银行"、"GitHub"、"公司 VPN"……）——清单本身就是情报。

目标：凭证名称纳入 E2EE（DEK 加密，v2 密文格式），搜索从服务端 SQL 改为前端内存
明文索引 + 本地过滤，服务端对凭证名称彻底零知识。**用户已确认的方案边界**：
只加密 name；icon/markColor 保持明文（固定白名单枚举，无情报价值，且让列表渲染
免解密）；单人数据量（百级条目）下前端全量解密毫秒级完成。

**非目标**：不加密分组名 Group.name（同属元数据，但先验证 name 模式跑通，分组名
留二期）；不改 content 加密方式；不动 icon/markColor/schema 其余字段。

**前置依赖**：`docs/plans/security-hardening/` 批次先合入（本计划在其 2.1.0 之后
实施，基于 10 分钟绝对超时后的代码基线）。

## 2. 方案概要（已敲定决策）

1. **schema 双字段过渡**（D-schema）：`Certificate` 新增 `nameEnc String @default("")`，
   旧 `name` 列保留但停止业务写入（迁移期读旧写新）；`User` 增加
   `metadataVersion Int @default(1)`（1=明文，2=已加密），作为前端迁移开关与
   迁移完成标志。v2 完成后（下个大版本）再删 `name` 列。
2. **后端只做透传**（D-backend）：`certificate/search` 接口整体删除；list/search
   类接口返回 `nameEnc`；add/update 接收 `nameEnc`。后端不新增任何密码学代码，
   nameEnc 就是一段不透明字符串。
3. **前端内存明文索引**（D-index）：登录后拉全量凭证索引
   `{id, nameEnc, icon, markColor, updatedAt, groupId}`，DEK 批量解密 name 构建
   `{id → 明文名}` 索引，存 jotai 内存 atom（与 DEK 同生命周期，logout 即清）；
   react-query 缓存里只有密文。搜索页、列表页、侧边栏读该索引。
4. **存量迁移**（D-migrate）：登录后前端检测 `metadataVersion===1` → 弹迁移提示
   （复用 v1→v2 迁移的交互模式）→ 拉全量明文 → 逐条 `encryptContent(dek, name)`
   → 批量提交 `nameEnc` + 更新 `metadataVersion=2`（后端单接口单事务）→
   中断可重试（以"还有多少条 nameEnc 为空"判断进度，天然幂等）。
5. **搜索改本地**（D-search）：搜索页删除对 `certificate/search` 的调用，改为内存
   索引上做 名称包含 + 颜色筛选 + 日期过滤 + 分页（纯前端逻辑，分页只是切片）。
   颜色筛选的 markColor 仍是明文字段，逻辑不变。

## 3. 公共上下文

### 技术栈与结构

- 沿用 security-hardening 批次后的代码基线（全 POST、绝对超时、CSP 已上线）。
- 加密原语全部复用 `frontend/src/lib/e2ee/`（encryptContent/decryptContent 已有，
  含 KAT 测试）；密文格式 `v2:aes-256-gcm:...` 不变。
- DEK 生命周期不变：登录解包进 `stateVault`，logout 覆写清除。

### 本计划关键文件

| 关注点 | 文件 |
| --- | --- |
| schema | `backend/prisma/schema.prisma`（Certificate/User）+ 新 migration |
| 搜索接口删除 | `backend/src/modules/certificate/{controller,service}.ts` + `backend/src/types/certificate.ts` |
| list 返回改造 | `certificate/service.ts` 的 listByGroup/detail（detail 本就返回全量字段，补 nameEnc） |
| 前端索引 | `frontend/src/store/`（新 atom，如 `state-cert-name-index.ts`）+ `frontend/src/services/certificate.ts`（新 useCertIndex） |
| 搜索页 | `frontend/src/pages/search/index.tsx`（重写数据源） |
| 列表渲染 | `frontend/src/pages/certificate-list/**`（名称显示改读索引） |
| 迁移流程 | `frontend/src/pages/` 新迁移提示组件 + `frontend/src/services/user.ts`（metadataVersion 拉取/更新） |

### 已知的坑

- **e2e 是最大适配面**：`packages/e2e` 的 fixtures 已用真实 KDF 派生，但凭证断言
  目前基于明文 name；改造后 e2e 需用 fixtures 内 DEK 解密 nameEnc 再断言，或断言
  改为针对 nameEnc 密文格式前缀（`v2:aes-256-gcm:`）。全局搜索
  e2e 用例（若有）需改为前端行为断言。
- 索引必须在凭证 add/update/delete/move 后失效重建（react-query invalidate 已有
  机制，挂在 `["certificateIndex"]` query key 上）。
- 迁移接口的批量提交要有条数上限（如 100/批），避免单请求过大；后端事务包住
  "这批 nameEnc + 最后一笔顺带 metadataVersion=2"。
- `metadataVersion` 判断放在 login 响应里下发（响应已含 salt/keyBlob/kdfParams，
  顺路），避免为它单开接口。
- decryptContent 逐条 await 在百级条目下可接受，无需批量优化（实测 GCM 单次 <1ms）；
  但要 try/catch 单条失败不阻塞整体索引（失败条目名称显示"解密失败"占位）。

## 4. 端到端验收

一段话：升级版本后登录 → 出现一次性迁移提示 → 完成后数据库 `main.db` 中
Certificate.nameEnc 全为 v2 密文、name 为旧明文残留（只读不写）、User.metadataVersion=2；
搜索页输入关键字命中结果与改造前一致（含颜色/日期筛选）；列表/详情名称正常显示；
DevTools Network 中不存在 certificate/search 请求；logout 后内存索引清空。

验证命令：

```sh
pnpm lint
pnpm --filter backend test && pnpm --filter backend build
pnpm --filter frontend test && pnpm --filter frontend build
pnpm test:e2e
# 迁移验证（手动）：用旧版本建库存几条凭证 → 升级 → 走迁移流程 → sqlite3 查 nameEnc
```
