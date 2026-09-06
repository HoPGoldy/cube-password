# 优化方案：认证栈一致性 + 遗留清理 + 状态管理规范化

## 1. 背景与目标

对 cube-password 的全面架构评审（2026-09 访谈）发现三类问题：认证栈行为与项目原则不一致（Locker 按 IP 过滤违背"全局锁定"原则、锁定分组写操作无门禁）、cube-diary 复制骨架带来的遗留（multipart/512MB、mockjs 进生产路径、静态 index.html 一次性替换缺陷）、前端双状态体系并存（分组列表在 jotai 手动同步 vs 凭证列表走 react-query）。

本 PRD 将认证行为对齐 AGENTS.md 已记录原则，清除遗留，统一前端状态范式。**允许改变行为与接口契约**（单用户自部署，前后端同仓同镜像发布，无兼容包袱）。

**非目标**（讨论中已明确否决/暂缓，实施时不得反复）：

- 挑战码改客户端回传模式：已否决。pop 模式与「泄露探测器」哲学自洽（任何无效挑战触碰=静默拒绝，密码错误才告警），接口自包含的工程收益不值当改契约；
- 分组解锁限流：保持现状，依赖 nginx 隐藏 + 单人服务（已知边界，不修）；
- 分组锁 name/markColor/icon 明文可见：E2EE 已知代价（搜索需要明文名），不动；
- `Group.keyBlob` 分组独立加密：暂缓实施，**保留列不写入不删除**，注释维持"预留：分组独立加密（规划中）"；
- salt/kdfParams 静态注入 index.html：已否决。salt 每次改密都变、init 前不存在，注入通道只承载部署期常量；二者维持 API 下发（`/auth/global` / login 响应 / group 列表三处，分别服务登录派生、改密快照、分组解锁）；
- TOTP 相关逻辑（绑定/解绑/分组 Totp 锁）：不动。

## 2. 方案概要（已敲定决策）

1. **挑战码全局单码 + pop 模式保持，语义收敛**（D2）：`ChallengeManager` 简化为单槽位（一个 code + 过期时间，生成即覆盖，pop 即清空），删除 `popLastChallenge` 的 Map 遍历；otp/remove 保持"客户端回传 + `validateChallenge`"现状不动（两种模式并存已接受）；login 校验次序改为**先查锁再 pop**（锁定期间垃圾请求不烧码不翻新码）；**pop 失败 → 静默 401**：删除"非法登录" `createNotice`、不记失败数，仅返回错误响应；"密码错误 → 通知 + recordLoginFail + 全局锁定"路径保留不动。
2. **锁定分组写操作加门禁**（D4）：`CertificateService` 的 `add`/`update`/`delete`/`move`/`sort` 补 `isGroupUnlocked` 校验（`search` 不加——它跨组分页，门禁会破坏结果集语义，属读侧已知边界；`detail`/`listByGroup` 已有校验不动）。语义：锁 = 这个 session 完全碰不了。
3. **LoginLocker 去 IP 化**（D9）：`failRecords` 只存时间戳，`isLocked()` 用全局计数与 `getLockDetail` 口径归一；`login(hash, ip)` 签名去 ip，通知文案保留 ip 字符串（controller 层仍读 `request.ip` 仅用于文案）；`SchemaLoginFailRecord` 删 ip 字段；前端 `types/auth.ts` 手写副本删除，改用 `@shared-types/auth`（该通道已存在，`store/user.ts` 已在用）。
4. **index.html 注入改内存副本**（D-inject）：`registerFrontendHistory` 启动时读文件→替换→**存内存，不写回磁盘**；每请求返回内存副本。细节：`fastifyStatic` 关 `index` 选项（防磁盘原文件被抢先服务，根路径与 SPA fallback 统一走自己的 handler）；返回 `reply.send(Buffer.from(html))` 绕过 `unify-response` onSend 的 JSON 包装（2xx 字符串 payload 会被包成 `{success,code,data}`）；响应加 `Cache-Control: no-cache`（呼应 nginx 反代部署）。
5. **分组状态 server/client state 拆分**（D6）：分组服务端数据（id/name/lockType/salt/kdfParams/证书数）走 react-query（复活现有死代码 `useGroupList`，增删改后 `invalidateQueries`）；解锁态改为 jotai 单一 `stateUnlockedGroupIds: Set<number>` atom（`lockType==='None'` 组登录时加入；unlock 成功加入；logout 清空；派生 `unlocked = lockType==='None' || ids.has(id)`）；删 `stateGroupList` atom 及 4 处手动 `setGroups` 同步；后端 `addGroup` 只返回 `newId`（删 `newList`）。
6. **kdf-params 校验合并进仓库内新包 `packages/shared`**（D7）：pnpm workspace 子包（仅源码 export，不发布 npm），内容：`KdfParams` 类型、`DEFAULT_KDF_PARAMS`、`parseKdfParams` 及错误类。frontend 的 `lib/e2ee/kdf.ts` re-export 保持 `@/lib/e2ee` 对外接口不变；backend 删 `lib/kdf-params` 内联版改 import shared；e2e 经 `@frontend/lib/e2ee` 透传，不改。
7. **杂项打包**（D5/D8/D9）：backend tsconfig 升 `strict: true`；`certificate.sort`/`group.sort` 包 `$transaction`；axios 拦截器 403 跳转拼 `APP_CONFIG.PATH_BASENAME`；删 multipart 插件 + 512MB 上限、`PATH_USER_FILE`/`PATH_USER_FILE_THUMB`；rand-name 保留但换内置词表实现（删 mockjs + @types/mockjs）；README 重写为 cube-password 内容；index.html `<title>` 改 "Cube Password"；删 `dotenv`（留 dotenv-flow）、删 `console.log("path", ...)`、删 `ErrorBanned`/`requestDelete`/`requireAdmin` 死配置；`store/lcoal.ts` 改名 `local.ts`。

## 3. 公共上下文

- 技术栈：pnpm workspace monorepo（backend: fastify5 + typebox + prisma7/sqlite + tsx；frontend: react18 + vite5 + antd + jotai + react-query5；e2e: playwright）。
- 目录：`packages/backend/src`（modules/<name>/{controller,service,error}.ts + lib/<name>/ + types/）、`packages/frontend/src`（services/ react-query hooks + store/ jotai + lib/e2ee/ + pages/）、`packages/e2e`（fixtures/api.ts 内含 KDF 派生 helper，经 tsconfig paths `@frontend/*` 复用前端代码）。
- 协议：全 POST（除 `/auth/global`、`/auth/challenge`、`/config/version` 为 GET）；统一响应包装 `{success, code, data}` 由 `lib/unify-response` onSend hook 完成（**2xx 字符串 payload 会被 JSON 包装，返回 HTML 必须用 Buffer**）；错误经 `types/error.ts` ErrorHttp 层级。
- 认证链：session token（`X-Session-Token` header，preHandler hook 校验，`config.disableAuth` 豁免）→ challenge（pop 模式）→ 密码证明 `SHA512(hex(V)+challenge)` → 可选 TOTP。
- e2e 运行：`pnpm test:e2e`（根目录），playwright 自动拉起前后端 dev server（`reuseExistingServer`），`E2E_LOGIN_PASSWORD=admin`，dev 库已初始化时须与库密码一致（当前库 admin123 → 见 tasks/index.md 说明）。auth 全链路走真实 KDF 派生（fixtures/api.ts）。
- 已知的坑：`@shared-types/*` 与 `@db/*` 均为 tsconfig paths 直指源码目录的虚拟映射，新增 workspace 包须同时配 backend/frontend 的 paths；`unify-response` 会包装一切 2xx 字符串；frontend `nanoid` 锁 3.x（CJS 时代的 pin，勿顺手升级）。

## 4. 端到端验收

全部任务完成后：`pnpm lint` 零错误；`pnpm --filter backend test` 全绿；`pnpm --filter backend exec tsc --noEmit`、`pnpm --filter frontend exec tsc -p . --noEmit` 零错误；`pnpm --filter frontend build`、`pnpm --filter backend build` 成功；`pnpm test:e2e` 全绿（覆盖登录/锁定/分组解锁写门禁/改密/TOTP）；生产模式冒烟：`NODE_ENV=production` 启动后 `curl -i http://127.0.0.1:3499/` 返回 HTML 且 header 含 `Cache-Control: no-cache`、body 含替换后的 basename、重复请求结果一致（占位符不消耗）。
