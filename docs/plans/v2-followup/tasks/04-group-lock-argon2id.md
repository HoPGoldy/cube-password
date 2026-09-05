# T04: 分组锁升级 argon2id

## 目标

分组锁密码从 v1 弱哈希（`sha512(salt+pwd)`，可 GPU 秒破）升级为与主密码同构的 argon2id KDF 体系（context.md 决策 4）。存量数据的迁移由 T05 负责，本任务只做新格式链路。

## 上下文

- context.md 第 2 节决策 4、第 3 节 migration 说明。
- 复用 `packages/frontend/src/lib/e2ee` 的 `deriveMasterKey`（前后端同构）：argon2id(password, salt, kdfParams) → 64B，前 32B KEK（分组场景不使用，丢弃）+ 后 32B V。存储：`Group.passwordHash`=hex(V)、`passwordSalt`=hex(salt)、新增 `kdfParams` 列（与 User 表对称）。unlock 比对与 login 同款：`sha512(hex(V)+challenge)`。
- 旧格式判定：`kdfParams === ""` 即 v1 遗留，unlock 时明确报错提示重新设置（正式升级走 T05）。
- 涉及源码：`prisma/schema.prisma`（加列 + keyBlob 注释按 context.md 非目标更新）；backend `types/group.ts`（add/update-config body、list item 增加 kdfParams 下发）、`modules/group/service.ts`（addGroup/updateConfig 透传、unlock Password 分支重写、listGroups/login 下发）；frontend `components/add-group-modal.tsx`、`pages/certificate-list/components/group-config-modal.tsx`（设锁逻辑换 deriveMasterKey）、`pages/certificate-list/components/group-unlock.tsx`（kdfParams 解析失败显式报错）、`store/user.ts`（`GroupInfo` 贯穿 kdfParams）。
- `Group.keyBlob` 与 Totp 锁、None 锁逻辑全部不动（context.md 非目标）。

## 边界

只允许改动上列文件；解锁状态的前端同步机制保持现状；解锁约 0.5s 延迟不 specially 处理（表单已有 pending 态）。

## 验收

e2e 新增用例全绿：创建 Password 锁分组（v2 派生）→ list 下发 salt/kdfParams → 正确密码 unlock 成功、错误密码失败、旧格式（kdfParams=""）unlock 得到明确错误；backend/frontend build 通过；库检查新建锁定分组 kdfParams 非空、passwordHash 为 64 位 hex。

## 依赖

T01（challenge 相关改动同域）。
