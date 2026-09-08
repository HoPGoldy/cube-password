> **注（2026-09-08）**：本计划决策 5 的「gate token 内存态、10 分钟 TTL」已被后续批次
> [`docs/plans/ephemeral-gate-token/`](../ephemeral-gate-token/) 取代——token 改为每次登录
> 流程现取现用（TTL 3 分钟仅防御性上限），不再页面级缓存。本文其余内容仍有效。

# 设备门 (Device Gate)

## 1. 背景与目标

cube-password 是单人自部署的密码管理器，现有防线是「nginx 反代路径隐藏 + 3 次/天登录锁定」。锁定属于「快速暴露」而非「抵抗」：服务地址一旦泄露，任何扫描器都能从 `/auth/global` 拿到 `salt` / `kdfParams` / 锁定状态（离线爆破原料），并对 `/auth/login` 发起尝试。

目标：引入基于 WebCrypto 非导出密钥的设备准入门禁，等价 ssh 的 authorized_keys——只有绑定了设备钥匙的设备能进入登录面；陌生设备一律 403 + 去重通知。已过门禁的设备**每次登录时静默验签过门**（用户零感知），再走主密码登录，E2EE 密钥层级完全不动。

**非目标**（明确不做）：

- 不做 WebAuthn（用户验证弹窗与「静默过门」目标冲突；硬件隔离对本威胁模型属过度防御，见决策 2）；
- 不做 PRF/无密码解锁（设备钥匙不参与 KEK 派生，记录为 Phase 2 候选）；
- 不改单 session 互踢语义（`SessionManager` 保持单用户单 session）；
- 不做密码自助绑定、TOTP 自助绑定通道（绑定必须经已授权设备或服务器文件编辑）；
- 不改现有 LoginLocker / Challenge / E2EE 行为；
- 不将设备数据写入 SQLite/Prisma。

## 2. 方案概要（已敲定决策）

1. **`storage/trusted-devices.json` 为唯一 source of truth**：文件非空即门生效；每次验证直读文件，手工编辑（增删设备）即时生效、无需重启——这就是逃生门，不需要 env 开关。
2. **WebCrypto 非导出密钥代替 WebAuthn**（用户拍板：要静默过门）：`crypto.subtle.generateKey(ECDSA P-256, extractable: false, ['sign'])`，私钥材料永不出浏览器密钥库，页面代码（含注入脚本）只能拿句柄请求签名、拿不到字节；句柄存 IndexedDB，公钥导出 SPKI 进钥匙串。每次登录页面加载时自动「取挑战码 → 句柄签名 → 验签 → gate token」，全程零点击零弹窗。牺牲：不防「本机恶意软件翻浏览器 profile」（该档位由主密码+E2EE 兜底，与读库文件/keylogger 同级）。
3. **注册完全在浏览器本地**：密钥对生成不涉及服务端，导出为一段 base64url 钥匙串，由已授权设备的管理页录入，或手工粘贴进文件。未授权设备不存在任何可调用的注册接口。
4. **严格模式拦截**：门生效时，未携带有效 gate token 的请求只能访问 `POST /device/challenge`、`POST /device/verify`，其余一切 API（含 `auth/global`、`auth/challenge`、`auth/login`、`auth/init`）返回 403——彻底切断预登录信息泄露。
5. **Gate token 内存态、10 分钟 TTL**：仅用于登录走廊。每次登录 = 静默设备验签 + 主密码。session 语义不变。
6. **敲门失败语义**（AGENTS.md Principle 已更新）：陌生设备 verify 失败（含「本机无钥匙」）→ 即时 403 + `NoticeType.Warning` 通知（全局维度 1 小时去重，内存态，重启重置），**不进 LoginLocker、不影响任何访问**。全局锁定仅属于「已过门禁的设备输错密码」。

## 3. 公共上下文

### 3.1 技术栈与依赖

- 后端：fastify 5 + typebox，验签用 `node:crypto` 原生 `verify`（**零新依赖**）。
- 前端：react + antd + jotai + WebCrypto 原生 API（**零新依赖**）。
- 可运行参考实现：`spike/demo.html`（浏览器三步：生成/静默签名/偷钥失败）与 `spike/verify-demo.mjs`（服务端验签），已经无头浏览器 + Node 跨端闭环验证，T02/T03 直接参照。

### 3.2 目录与存储约定

- 后端模块模式见 `docs/how-to-build-a-new-module.md`；新模块放 `packages/backend/src/modules/device/`，新 lib 放 `packages/backend/src/lib/device-store/`。
- 存储根目录：`PATH_ROOT`（`packages/backend/src/config/path.ts`，dev 为 `packages/backend/storage/`，prod 为 `dist/../storage/`）。设备文件：`PATH_ROOT/trusted-devices.json`，格式：

```json
{
  "devices": [
    {
      "id": "nanoid",
      "name": "MacBook",
      "publicKey": "<base64url SPKI>",
      "createdAt": "ISO-8601",
      "lastSeenAt": "ISO-8601"
    }
  ]
}
```

- 写入建议 temp+rename 原子写；读写频率极低（仅登录时），无性能顾虑。

### 3.3 接口契约（全部 POST；现有 auth/challenge、auth/global 的 GET 是历史遗留，本期不动）

| 端点 | 鉴权 | 请求 | 响应 |
| ---- | ---- | ---- | ---- |
| `POST /device/challenge` | 无 | `{}` | `{ challenge, gateEnabled }` |
| `POST /device/verify` | 无 | `{ deviceId, challenge, signature }` | 成功 `{ gateToken }`；失败 403 ErrorDeviceGate |
| `POST /device/add` | session | `{ deviceKey: string }`（钥匙串） | `{ id }`；公钥重复报错 |
| `POST /device/list` | session | `{}` | `{ items: DeviceItem[] }` |
| `POST /device/revoke` | session | `{ id }` | `{}` |

- 设备钥匙串格式：`cube-device-key:v1:<base64url(JSON{ name, publicKey })>`（公钥为 SPKI base64），前后端共同遵守，version 前缀预留演进。
- gate token 通过请求头 `X-Gate-Token` 传递，仅登录流程期间由前端附带。
- 设备挑战码复用 `lib/challenge` 的 `ChallengeManager` 类，**新建独立实例**（与服务端登录挑战码实例分离，避免单槽位互相覆盖）。`/device/challenge` 同时承担登录页唯一探针：`gateEnabled: false` → 渲染现有密码表单（纯密码模式零变化）。
- verify 语义：服务端按 deviceId 查设备 → pop 设备挑战码比对 challenge（防重放）→ `crypto.verify('sha256', challenge, { key: SPKI, dsaEncoding: 'ieee-p1363' }, signature)` → 更新 lastSeenAt 回写文件 → 签发 gate token。**WebCrypto ECDSA 签名是 raw r‖s（IEEE P1363，64 字节）而非 DER**，`dsaEncoding: 'ieee-p1363'` 是官方对齐方式，spike 已验证。

### 3.4 前端钥匙管理（`packages/frontend/src/lib/device-key.ts`）

- 生成：`generateKey(ECDSA P-256, extractable: false, ['sign'])` → `exportKey('spki', publicKey)` → 组装钥匙串字符串展示/复制。私钥句柄连同 `{ deviceId, name, publicKey, createdAt }` 存 IndexedDB（库名如 `device-keys`，key 为 `deviceId`）。
- 静默过门：页面加载 → IndexedDB 取句柄 → `POST /device/challenge` → `sign({ name: 'ECDSA', hash: 'SHA-256' }, handle, challenge)` → `POST /device/verify`。任何一步失败（无句柄/验签 403）→ 渲染「此设备未授权」页面。
- 语义边界：句柄 = 浏览器内部密钥库的引用；换浏览器/清 profile/换机器 = 钥匙消失 = 未授权，走重绑流程。`extractable: false` 只锁私钥，公钥永远可导出（规范行为）。

### 3.5 门禁强制点

- 在 register-service 注册一个 `preHandler` hook（注册顺序在 auth controller 的 session hook 之前）：当门生效（文件非空）且路由属于 `disableAuth: true` 的预登录路由（`auth/global`、`auth/challenge`、`auth/login`、`auth/init`）且路径不是 `/device/challenge|/device/verify` 时，校验 `X-Gate-Token`（内存 manager，10min TTL）。session 保护的常规路由**不**要求 gate token（gate 只守登录走廊，session 守房间）。
- `@fastify/static` 静态资源不在 `/api` 前缀下，不受影响（未授权设备必须能加载前端页面才能看到门禁 UI）。
- 新错误类型 `ErrorDeviceGate`（403），前端据此渲染设备门 UI。
- `crypto.subtle` 要求安全上下文：生产需 HTTPS（nginx TLS 后天然满足）；dev 下 vite proxy 的 `http://localhost:5173` 是安全上下文，**无 WebAuthn 时代的 RP ID/Origin env 配置**，全部删除。

### 3.6 通知与测试约定

- 敲门失败通知去重：内存态，全局 1 小时窗口 1 条 `NoticeType.Warning`（含来源 IP）；重启重置窗口，可接受。
- 后端单测覆盖：device-store CRUD/格式、gate token TTL、敲门通知去重、设备挑战码 pop、`ieee-p1363` 验签（用 `node:crypto` 生成测试向量，参照 spike 的自测方式）。
- e2e：**无需虚拟认证器**——playwright 测试里可直接 `page.evaluate`/`addInitScript` 调 WebCrypto 生成密钥并注入 IndexedDB，或直接对 `/device/verify` 发起签名请求构造通过/拒绝用例。
- e2e 注意：`playwright.config.ts` 的 webServer 就绪探针打 `GET /api/auth/global`，门生效时返回 403 也视为就绪（Playwright 对 2xx-4xx 均视为 ready）；**现有密码登录 e2e 必须保持在门未激活状态下全绿**。`global-setup.ts` 需同步清理 `trusted-devices.json`。

## 4. 端到端验收

门未激活：现有全部后端单测与 e2e 通过，系统行为与现状一致（探针返回 `gateEnabled: false`，登录流程零变化）。门激活（e2e 用 WebCrypto 注入钥匙）：绑定首台设备 → 登出 → 登录页加载即静默过门直接显示密码表单 → 登录成功；无钥匙的全新 context 访问 `/auth/global` 得 403、敲门通知两次只落 1 条；手工编辑 `trusted-devices.json` 增删设备即时生效。

验证命令：

```bash
pnpm --filter backend test     # 后端单测
pnpm -w test:e2e               # 全量 e2e（含新增 device-gate.spec.ts）
```
