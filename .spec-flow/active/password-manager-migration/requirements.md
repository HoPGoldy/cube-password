# 密码管理器迁移 - Requirements

> **Status**: Draft
> **Proposal**: [proposal.md](./proposal.md)
> **Last Updated**: 2026-03-06

## Overview

将 cube-password-old 的密码管理业务完整迁移到 cube-password 新架构（Fastify 5 + Prisma + TypeBox），使用 Session 认证，保留全部安全特性。

---

## Functional Requirements

### Ubiquitous Requirements

- **FR-001**: 系统应使用 bcrypt 存储用户主密码哈希，cost factor ≥ 10。
- **FR-002**: 系统应对所有 POST 请求体过滤多余属性（已有 security lib）。
- **FR-003**: 系统应统一响应格式 `{ success, code, data, message }`（已有 unify-response）。
- **FR-004**: 凭证内容（certificate.content）在客户端加密后传输，服务端仅存储密文，不做解密。
- **FR-005**: 前端应通过响应式布局支持移动端访问（Ant Design + Tailwind 断点适配）。

### Event-Driven Requirements — 认证模块

- **FR-010**: When 客户端请求 `GET /api/challenge`，系统应返回一个一次性随机 challenge code（nanoid），有效期 5 分钟。
- **FR-011**: When 客户端请求 `GET /api/global`，系统应返回应用公开配置（应用名称、主题色、是否已初始化）。
- **FR-012**: When 系统未初始化且客户端提交 `POST /api/auth/init`（含主密码），系统应创建唯一用户记录并返回成功。
- **FR-012a**: When 系统未初始化且用户访问前端，系统应自动跳转到 `/init` 页面引导用户设置主密码。
- **FR-013**: When 客户端提交 `POST /api/auth/login`（含 `SHA512(password + challenge)` 哈希），系统应验证密码，成功后返回 session token + replay attack secret。
- **FR-013a**: When 登录成功且用户已绑定 TOTP，系统应要求用户提供 TOTP 验证码后才返回 session。
- **FR-014**: When 登录成功，系统应创建 session（30 分钟有效期），存储 token、replayAttackSecret、unlockedGroupIds。
- **FR-014a**: When 登录成功，系统应记录登录 IP 地址并通过 ip2region 查询地理位置。
- **FR-014b**: When 登录 IP 地理位置与用户 commonLocation 不一致，系统应创建 Warning 级别安全通知。
- **FR-015**: When 客户端提交 `POST /api/auth/logout`，系统应立即销毁当前 session。
- **FR-016**: When 客户端提交 `POST /api/auth/change-password`，系统应验证旧密码后更新密码哈希，并销毁当前 session。

### Event-Driven Requirements — 凭证模块

- **FR-020**: When 客户端提交 `POST /api/certificate/add`，系统应在指定分组下创建凭证记录。
- **FR-021**: When 客户端请求 `POST /api/certificate/detail`，系统应返回凭证完整信息（含加密后的 content）。
- **FR-022**: When 客户端提交 `POST /api/certificate/update`，系统应更新凭证字段。
- **FR-023**: When 客户端提交 `POST /api/certificate/delete`（含 ids 数组），系统应批量删除凭证。
- **FR-024**: When 客户端提交 `POST /api/certificate/move`，系统应将凭证移动到目标分组。
- **FR-025**: When 客户端提交 `POST /api/certificate/sort`，系统应更新凭证排序。
- **FR-026**: When 客户端提交 `POST /api/certificate/search`，系统应按关键字、颜色、日期范围分页查询凭证。

### Event-Driven Requirements — 分组模块

- **FR-030**: When 客户端提交 `POST /api/group/add`，系统应创建新分组。
- **FR-031**: When 客户端请求 `POST /api/group/list`，系统应返回所有分组（含每个分组的凭证数量）。
- **FR-032**: When 客户端提交 `POST /api/group/update-name`，系统应更新分组名称。
- **FR-033**: When 客户端提交 `POST /api/group/update-config`，系统应更新分组锁定类型（None/Password/Totp）。
- **FR-034**: When 客户端提交 `POST /api/group/unlock`（含密码哈希或 TOTP code），系统应验证后将该分组加入 session 的 unlockedGroupIds。
- **FR-035**: When 客户端提交 `POST /api/group/delete`，系统应删除分组并级联删除其下所有凭证。
- **FR-036**: When 客户端提交 `POST /api/group/sort`，系统应更新分组排序。
- **FR-037**: When 客户端提交 `POST /api/group/set-default`，系统应设置用户默认分组 ID。

### Event-Driven Requirements — OTP 模块

- **FR-040**: When 客户端请求 `POST /api/otp/get-qrcode`，系统应生成 TOTP secret 并返回二维码数据。
- **FR-041**: When 客户端提交 `POST /api/otp/bind`（含 TOTP 验证码），系统应验证后将 secret 存入用户记录。
- **FR-042**: When 客户端提交 `POST /api/otp/remove`（含密码 + TOTP 验证码），系统应清除用户的 totpSecret。

### Event-Driven Requirements — 通知模块

- **FR-050**: When 客户端请求 `POST /api/notification/list`，系统应分页返回安全通知列表（支持按类型和已读状态过滤）。
- **FR-051**: When 客户端提交 `POST /api/notification/read-all`，系统应将所有通知标记为已读。
- **FR-052**: When 客户端提交 `POST /api/notification/remove-all`，系统应删除所有通知。
- **FR-053**: When 登录失败、从异常位置登录、修改密码等安全事件发生时，系统应自动创建对应类型的通知记录（含 IP 地址及地理位置信息）。

### Event-Driven Requirements — 用户模块

- **FR-060**: When 客户端提交 `POST /api/user/set-theme`，系统应更新用户主题设置。
- **FR-061**: When 客户端请求 `POST /api/user/statistic`，系统应返回分组数量和凭证数量。
- **FR-062**: When 客户端提交 `POST /api/user/create-pwd-setting`，系统应更新密码生成器配置（字符集、长度）。

### State-Driven Requirements

- **FR-070**: While 用户已认证（session 有效），系统应对每个请求自动续期 session（重置 30 分钟倒计时）。
- **FR-071**: While 分组为已锁定状态（lockType ≠ None）且未在 session 中解锁，系统应拒绝返回该分组的凭证内容。
- **FR-072**: While 系统未初始化（无用户记录），系统应仅允许访问 `/api/auth/init`、`/api/global`、`/api/challenge`。

### Unwanted Behavior Requirements

- **FR-080**: If session 已过期（超过 30 分钟未活动），系统应不处理该请求，返回 401。
- **FR-081**: If 同一 IP 当日登录失败 ≥ 3 次，系统应不允许该 IP 继续尝试登录。
- **FR-082**: If replay attack 签名验证失败（时间戳超过 1 分钟或签名不匹配），系统应不处理该请求。
- **FR-083**: If 用户已存在，系统应不允许再次执行 init 创建用户。

---

## Non-Functional Requirements

### Performance

- **NFR-001**: 系统应在 200ms 内响应所有 API 请求（本地 SQLite 环境下）。

### Security

- **NFR-010**: 系统应使用 bcrypt（cost ≥ 10）存储密码哈希。
- **NFR-011**: 系统应不在任何日志中记录密码明文或会话令牌。
- **NFR-012**: 系统应对 Challenge code 设定 5 分钟最大有效期。
- **NFR-013**: 系统应在每次登录成功后生成新的 replay attack secret。

### Reliability

- **NFR-020**: 系统重启后，所有 session 自动失效（内存存储，设计如此），用户需重新登录。

### Maintainability

- **NFR-030**: 每个后端模块应遵循 Controller + Service + TypeBox 三层结构。
- **NFR-031**: 所有 API schema 应使用 TypeBox 定义，确保请求/响应类型安全。

---

## Constraints

- **C-001**: 单用户系统，首次访问触发 init 流程设置主密码，仅支持一个用户。
- **C-002**: 认证使用 Session（非 JWT），须支持 30 分钟精确过期。
- **C-003**: 凭证内容仅在客户端加解密（AES-256-CBC），服务端不持有明文。
- **C-004**: 前端框架限定为 React 18 + Ant Design 5 + Jotai + TanStack Query。

## Assumptions

- **A-001**: 部署环境为单实例（不考虑多实例共享 session）。
- **A-002**: 旧项目数据不需要自动迁移，用户可手动导入。
- **A-003**: IP 地理位置功能使用 ip2region 本地离线数据库，不依赖外部服务。

---

## Acceptance Criteria

### 认证流程

- [ ] **AC-001**: Given 系统未初始化, when 提交 init 请求, then 创建用户并返回成功。
- [ ] **AC-002**: Given 系统已初始化, when 提交正确的 challenge + 密码哈希, then 登录成功并返回 token + secret。
- [ ] **AC-003**: Given 用户已登录, when 30 分钟内无活动, then 下次请求返回 401。
- [ ] **AC-004**: Given 用户已登录, when 提交 logout, then session 立即失效。

### 凭证管理

- [ ] **AC-010**: Given 用户已登录, when 创建凭证, then 凭证出现在对应分组。
- [ ] **AC-011**: Given 凭证存在, when 请求详情, then 返回完整数据（含加密 content）。
- [ ] **AC-012**: Given 多个凭证, when 批量删除, then 指定凭证全部移除。
- [ ] **AC-013**: Given 关键字, when 搜索, then 返回匹配凭证列表（分页）。

### 分组管理

- [ ] **AC-020**: Given 用户已登录, when 创建分组, then 分组出现在列表中。
- [ ] **AC-021**: Given 分组有 Password 锁, when 未解锁, then 无法获取该分组凭证列表。
- [ ] **AC-022**: Given 分组有 Password 锁, when 提交正确密码, then 解锁成功，可获取凭证。
- [ ] **AC-023**: Given 分组被删除, when 查询凭证, then 该分组下凭证全部消失。

### OTP

- [ ] **AC-030**: Given 用户未绑定 TOTP, when 请求 QR code, then 返回可扫描的二维码数据。
- [ ] **AC-031**: Given 用户已绑定 TOTP, when 提交正确验证码 + 密码, then 解绑成功。

### 安全

- [ ] **AC-040**: Given 同一 IP 连续 3 次登录失败, when 第 4 次尝试, then 返回 403。
- [ ] **AC-041**: Given replay attack header 时间戳超过 1 分钟, when 发送请求, then 返回 401。

### 初始化流程

- [ ] **AC-050**: Given 系统未初始化, when 用户访问前端, then 自动跳转到 init 页面。
- [ ] **AC-051**: Given 系统未初始化, when 用户在 init 页面输入主密码并提交, then 创建用户并跳转到登录页。
- [ ] **AC-052**: Given 系统已初始化, when 用户访问 /init, then 跳转到登录页。

### IP 地理位置

- [ ] **AC-060**: Given 用户从新 IP 登录且与 commonLocation 不一致, when 登录成功, then 系统创建异地登录警告通知。

### 移动端适配

- [ ] **AC-070**: Given 用户使用移动设备访问, when 浏览凭证列表页, then 页面布局自动适配小屏幕。
