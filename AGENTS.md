# AGENTS.md

## Glossary

### 挑战码 (Challenge)

全局唯一的登录挑战码，服务端生成、服务端 pop 消费，客户端不回传。存于 `lib/challenge`。5 分钟 TTL，全局单槽位：生成即覆盖旧码。一次性消费，被任何请求 pop 或过期后即失效。pop 失败 → 静默 401（无通知、不记失败数）；密码错误才触发通知与全局锁定。

### 登录锁 (LoginLocker)

全局失败计数（无 IP 维度），3 次/天锁死一切登录尝试（`lib/login-locker`）。锁定本身即「服务地址泄露」的告知信号（见 Principle 第三条）。

### totpSecret

本系统自用的验证因子（改密码确认、分组 Totp 锁），**不是**外部服务的 2FA 种子库。明文存储是经分析后的接受项：拿到它不构成独立攻击能力（详见 `docs/not-fix-issue.md`）。

### 设备门 (Device Gate)

基于 WebCrypto 非导出密钥的设备准入门禁，等价 ssh 的 authorized_keys。`storage/trusted-devices.json` 为唯一 source of truth（不进 SQLite/Prisma）：文件非空即门生效，为空或不存在则门未激活（纯密码模式）。每次验证直读文件，手工编辑无需重启。门生效时，未过门禁的请求只能访问 `/device/challenge`、`/device/verify`，其余路由（含 auth/global、auth/challenge、auth/login、auth/init）一律 403。

### 设备钥匙 (Device Key)

设备在浏览器本地通过 WebCrypto 生成的 ECDSA P-256 密钥对（`extractable: false`，私钥材料永不出浏览器密钥库，页面只能拿句柄签名），句柄存 IndexedDB，公钥导出 SPKI 打包为一段 base64url 钥匙串（`cube-device-key:v1:` 前缀）。录入方式：已授权设备的管理页，或直接编辑 trusted-devices.json（即逃生门）。钥匙不绑域名：换域名/换 nginx 路径均不影响；但换浏览器/清 profile 即失效，需重绑。

### Gate Token

门禁通过凭证：内存态、10 分钟 TTL、单次登录流程用。每次登录 = 静默设备验签（页面加载自动完成，零点击）+ 主密码，session 语义不变（仍单 session 互踢）。

## Principle

- 本项目仅为单人服务设计
- 部署者应通过 nginx 反代隐藏当前服务，路径是第一道防线
- “login 失败时全局锁定”是有意为之，目的是告诉用户当前服务地址已泄露
- 应用安全设计以「最快速暴露异常」为目标，不抵抗已知服务地址的攻击者（发现被攻击 → 换 nginx 反代路径即可）
- 门禁失败（陌生设备敲门）只通知不锁定，通知按时间窗去重落库；全局锁定仅属于「已过门禁的设备输错密码」
- 接口采用全 POST method
