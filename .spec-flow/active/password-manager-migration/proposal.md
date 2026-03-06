# 密码管理器迁移 - Proposal

> **Status**: Draft
> **Author**: AI Agent
> **Created**: 2026-03-06
> **Last Updated**: 2026-03-06

## Background

cube-password-old 是一个功能完整的单用户密码管理器，使用 Koa + Knex + SQLite3 架构。业务功能正确但架构老旧（Joi 验证、Knex 手写 SQL、无类型安全的响应格式）。

cube-password 是基于新架构（Fastify 5 + Prisma + TypeBox monorepo）的项目模版，目前包含的是 cube-diary 日记功能，需要替换为密码管理器业务。

本次迁移的核心是：**保留新架构骨架，移植旧项目的全部密码管理业务逻辑**。

## Goals

- [ ] Goal 1: 将 cube-password-old 的全部密码管理功能（凭证、分组、OTP、安全通知）迁移到新架构
- [ ] Goal 2: 使用 Session 认证（非 JWT），保持 30 分钟即时过期机制，适配单用户场景
- [ ] Goal 3: 保留旧项目的安全特性（Challenge 登录、Replay Attack 防护、暴力破解防护、客户端 AES 加密）
- [ ] Goal 4: 清除所有 cube-diary 相关代码

## Non-Goals

- 不做数据迁移工具（旧数据库 → 新数据库的自动迁移脚本不在本次范围内）
- 不改变业务功能本身（不新增功能，不修改交互逻辑）
- 不引入新的前端 UI 框架（继续使用 Ant Design + Tailwind）
- 不做多用户支持

## Scope

### In Scope

- 删除全部 cube-diary 代码（后端模块、前端页面、E2E 测试、Prisma 模型）
- 新建 Prisma 模型：User、Group、Certificate、Notification
- 新建后端模块：auth（改造）、user、group、certificate、otp、notification
- 认证系统：Session-based（服务端 in-memory），30 分钟超时，支持分组解锁状态追踪
- 安全机制：Challenge code 登录、Replay attack header 签名、IP 级 LoginLocker
- 前端页面：login、init、certificate-list、search、setting、change-password、otp-config、security-log、about
- 移动端响应式适配（沿用旧项目的响应式方案，Ant Design + Tailwind 断点适配）
- IP 地理位置查询（移植旧项目 ip2region 本地离线查询，用于异地登录检测）
- 前端加密：移植 CryptoJS（SHA512、AES-256-CBC、Replay attack headers）
- E2E 测试覆盖核心 API

### Out of Scope

- 旧数据自动迁移脚本
- 国际化

## Proposed Solution

### 认证方案：Session-based

由于这是单用户应用，使用 Session 认证而非 JWT：

1. **服务端 SessionManager**：内存中维护单一 session 对象，包含 token、replayAttackSecret、unlockedGroupIds
2. **30 分钟过期**：每次请求自动续期，超时后 session 立即失效
3. **Challenge 登录**：服务端生成一次性 challenge code，客户端用 `SHA512(password + challenge)` 验证
4. **Replay Attack 防护**：登录成功后下发 secret，客户端每次请求生成签名 headers
5. **替换 @fastify/jwt**：移除 JWT 插件，改用自定义 session 中间件（preHandler hook）

### 模块化迁移

按新架构的 Controller + Service + TypeBox 模式，逐模块重写旧项目业务：

- 旧项目的 Koa router → 新项目的 Fastify controller
- 旧项目的 Joi schema → 新项目的 TypeBox schema
- 旧项目的 Knex 查询 → 新项目的 Prisma ORM

## Alternatives Considered

| Alternative              | Pros               | Cons                                         | Why Rejected                                |
| ------------------------ | ------------------ | -------------------------------------------- | ------------------------------------------- |
| JWT 认证                 | 无状态、新架构已有 | 无法即时过期、需额外追踪分组解锁状态         | 单用户场景下 session 更简单直接，可即时过期 |
| 保留旧架构只升级依赖     | 改动最小           | Koa 生态老化、无 TypeBox 类型安全、无 Prisma | 不符合架构升级目标                          |
| 渐进式迁移（双架构共存） | 风险低             | 复杂度高、维护两套代码                       | 项目规模小，一次性迁移更高效                |

## Risks and Mitigations

| Risk                              | Likelihood | Impact | Mitigation                                                        |
| --------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Session 机制实现不当导致安全漏洞  | Medium     | High   | 对照旧项目逐行移植，保留全部安全检查                              |
| Prisma 与旧 Knex schema 不兼容    | Low        | Medium | 新建 schema，不依赖旧数据库结构                                   |
| 前端加密逻辑（CryptoJS）移植遗漏  | Medium     | High   | 编写 E2E 测试覆盖加密/解密流程                                    |
| 移除 JWT 后影响 access-token 模块 | Medium     | Low    | access-token 模块独立于 session 认证，可保留 JWT 仅用于 API token |
| ip2region.xdb 文件需要定期更新    | Low        | Low    | 可后续通过 CI 自动更新，不影响核心功能                            |

## Dependencies

- `otplib` — TOTP 生成和验证
- `qrcode` — 二维码生成
- `crypto-js` — 前端 AES 加解密 + SHA512
- `nanoid` — Session token 生成

## Success Metrics

| Metric         | Current          | Target                   | How to Measure                               |
| -------------- | ---------------- | ------------------------ | -------------------------------------------- |
| 业务功能覆盖率 | 0%（diary 功能） | 100%（全部密码管理功能） | 对照旧项目 API 列表逐一验证                  |
| E2E 测试通过率 | N/A              | 100%                     | `pnpm test:e2e`                              |
| 安全特性保留   | 0/4              | 4/4                      | Challenge、Replay、LoginLocker、AES 全部工作 |

## Open Questions

- [x] 认证方案选择 → **已决定：Session-based，30 分钟超时**
- [x] 移动端适配 → **已决定：需要做，通过响应式布局实现**
- [x] IP 地理位置查询 → **已决定：需要做，移植 ip2region 本地离线查询**
- [x] attachment 模块 → **已决定：移除，密码管理器不需要文件上传**
- [x] 用户初始化流程 → **已决定：首次访问触发 init 页面，引导用户设置主密码**
- [ ] access-token 模块是否保留？（当前用 JWT 签发 API token，可独立于 session 认证）

## References

- cube-password-old 源码：`/Users/wesley.huang/project-learn/cube-password-old/`
- 新模块开发指南：`docs/how-to-build-a-new-module.md`
- 开发规范：`.agents/skills/dev-guidelines/SKILL.md`
