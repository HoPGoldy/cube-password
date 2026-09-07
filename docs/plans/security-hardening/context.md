# 安全加固批次（根源修复）

## 1. 背景与目标

2026-09 对 cube-password 做了一轮全面安全评审（4 模块并行 + 主线复核），产出 8 个
Should-fix 与若干低危项。逐项与用户 grill-me 访谈后，按「根源修复 > 打补丁」的原则
重新筛选：**不修的项及理由已固化在 [`docs/not-fix-issue.md`](../../not-fix-issue.md)**
（含挑战码覆盖 DoS、totpSecret 明文、三入口失败计数等"看起来该修但被威胁模型豁免"的项），
本计划只包含通过筛选的根源级修复。

现状核心风险：session 滑动续期可无限存活（30 分钟超时名存实亡）；无 CSP（XSS 即可窃取
内存中的 DEK 与明文）；lockType 无枚举校验且 unlock 存在 fall-through（非法锁类型 =
一碰就开的假锁）；rand-name 接口响应双重包装（功能已坏）。

**非目标**（明确不做，详见 not-fix-issue.md）：挑战码多槽位、TOTP secret 加密、
change-password/分组锁失败计数、剪贴板自动清理、弱密码强制拒绝、元数据加密（独立立项，
见 `docs/plans/metadata-encryption-*/`）。

## 2. 方案概要（已敲定决策）

1. **10 分钟绝对会话超时**（D-session）：`SessionManager` 从滑动续期改为绝对超时——
   session 创建时记录 `createdAt`，无论是否活跃，存活超过 10 分钟即过期销毁。
   前端右上角显示剩余时间倒计时，到期被 401 弹回登录页；**不做编辑现场保护**（超时
   丢弃未保存内容，用户决策）。服务重启导致内存 session 全部蒸发——接受，不持久化。
2. **CSP 直接上线**（D-csp）：`@fastify/helmet` + 严格 CSP：
   `script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';
   connect-src 'self'; frame-ancestors 'none'` 等 Helmet 默认头。
   两个口子为必须：`wasm-unsafe-eval`（hash-wasm）、style 的 `unsafe-inline`（antd
   运行时样式）。不做 Report-Only 观察期（用户即唯一使用者）。
3. **lockType 枚举 + fall-through 堵死**（D-lock）：`types/group.ts` 中 lockType 改
   `Type.Union` 三 literal（None/Password/Totp），非法值 400；`group/service.ts` 的
   `unlock()` if 链末尾补显式 `else throw`（未知锁类型必须炸，禁止静默放行）。
4. **rand-name 前端化**（D-rand）：两个名字常量数组搬到前端，本地 `Math.random()`
   组合；后端删除 `/certificate/rand-name` 路由与 `getRandName` service。随机源
   不换 crypto（名字非敏感数据，用户确认）。
5. **代码卫生包**（D-hygiene，纯代码级无行为变化）：login/change-password/otp-config
   失败分支补 `kek.fill(0)`（约 8 处，成功路径已有）；`lib/crypto` 增加
   `timingSafeEqual` 封装并替换 auth/otp/group 的 4 处 `!==` 比对；logout 时
   `queryClient.clear()`；certificate detail Modal 补 `destroyOnClose`。
6. **全 POST 统一**（D-post）：`/auth/challenge`、`/auth/global` 从 GET 改 POST
   （对齐 AGENTS.md「接口采用全 POST method」原则）；前端 services 与 e2e 跟随。
   注意 `/config/version` 也是 GET，一并改。
7. **P2003 映射**（D-p2003）：`lib/unify-response` 的 PrismaErrorFeedback 增加
   P2003 → 400「访问的资源不存在」（现为 500「数据库错误」）。
8. **交付方式**（D-deliver）：全部改动**一个批次交付**，不拆 PR；最后整体跑
   lint + backend/frontend test + e2e。版本号 **2.1.0**（含行为变化与新功能）。

## 3. 公共上下文

### 技术栈与结构

- pnpm monorepo：`packages/backend`（Fastify 5 + typebox + Prisma/SQLite + vitest）、
  `packages/frontend`（React 18 + antd 5 + jotai + react-query + vite 5 + vitest）、
  `packages/e2e`（Playwright，fixtures/api.ts 内含 KDF 派生 helper）。
- 后端源码别名 `@/` → `backend/src/`；前端 `@shared-types/*` 指向 backend types。
- DI 结构：`app/register-service.ts` 为组合根，手动构造 service 并传给 controller。

### 本批次关键文件

| 关注点 | 文件 |
| --- | --- |
| session 超时 | `backend/src/lib/session/index.ts`（滑动续期在 getSession，需重构） |
| 认证 preHandler | `backend/src/modules/auth/controller.ts:29-38`（401 从这里抛出） |
| CSP 挂载点 | `backend/src/app/register-plugin.ts`（新依赖 @fastify/helmet） |
| lockType 校验 | `backend/src/types/group.ts:24,61` + `backend/src/modules/group/service.ts`（unlock 的 if 链 :116-181） |
| rand-name | `backend/src/modules/certificate/controller.ts:19-148`（删）+ `frontend/src/services/certificate.ts:13-15`（删）+ `frontend/src/pages/certificate-list/components/certificate-field-item.tsx:67-75`（改本地生成） |
| 失败分支覆写 | `frontend/src/pages/login/page.tsx`、`pages/change-password/content.tsx`、`pages/otp-config/content.tsx` |
| timingSafeEqual | `backend/src/lib/crypto/index.ts`（加封装）+ auth/otp/group service 的 4 处比对 |
| react-query 缓存 | `frontend/src/store/user.ts` logout() + `services/base.ts` queryClient |
| 全 POST | `backend/src/modules/auth/controller.ts`、`backend/src/modules/app-config/controller.ts`、`frontend/src/services/{auth,app-config}.ts`、`e2e/fixtures/api.ts` |
| 倒计时 UI | `frontend/src/layouts/app-container/index.tsx`（右上角挂载点）+ `store/user.ts`（登录时刻入 store） |

### 已知的坑

- `unify-response` 的 onSend 会包装一切 2xx 字符串 payload，返回 HTML 必须用 Buffer
  （frontend-history 已如此，改 helmet 时不要碰这个行为）。
- e2e `fixtures/api.ts` 直接用 fetch 调接口，GET/POST 改动必须同步，否则 e2e 全红。
- 前端 nanoid 锁 3.x（CJS pin），勿顺手升级。
- SessionManager 是内存单例、单 session（登录即销毁旧会话），改绝对超时时保持该模型，
  仅把「每次 getSession 续期」改为「不续期 + createdAt 判定」。
- 前端倒计时的起点：login 响应到达时刻即可（与服务端 createdAt 有 <1s 误差，可接受；
  真实判定以服务端 401 为准，倒计时只是提示 UI）。
- CSP 上线后先本地全功能过一遍再跑 e2e：hash-wasm 的 wasm 与 antd 的 style 注入是
  仅有的两个必须开口子的点；若 e2e 中出现其他 CSP 违规，按报错逐项评估而不是盲目加白。

### 交付顺序建议（同一批次内）

卫生包（无行为变化）→ lockType/P2003/全 POST（后端小改）→ 绝对超时（后端+前端倒计时）
→ rand-name 前端化 → CSP（最后上，避免被前面的改动干扰排查）→ 全量验证。

## 4. 端到端验收

一段话：登录后右上角出现 10 分钟倒计时；静置或活跃使用 10 分钟后任意操作触发 401 并
弹回登录页（编辑中内容丢弃）；lockType 传非法值返回 400；rand-name 在前端生成不再发
请求；浏览器 DevTools 响应头可见 CSP；全仓 lint/test/e2e 绿。

验证命令：

```sh
pnpm lint
pnpm --filter backend test && pnpm --filter backend build
pnpm --filter frontend test && pnpm --filter frontend build
pnpm test:e2e
```
