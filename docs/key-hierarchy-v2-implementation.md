# 密钥分层 V2 实施方案

> 状态：已评审（grill-me 决策全部敲定）
> 前置文档：[key-hierarchy-design.md](./key-hierarchy-design.md)（威胁模型、架构图、缺陷分析以该文档为准，本文不重复）
> 范围：**方案 A（全局 DEK）**，V2 破坏性更新，不做应用内迁移

## 1. 决策记录（本次评审产出）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 范围分期 | 一期只做方案 A（全局 DEK，修缺陷 1~4），但 Prisma 里**预留 `Group.keyBlob` 字段**（留空不用），二期方案 B 时无需再加列 |
| 2 | KDF 选型 | **Argon2id**，实现库 `hash-wasm`（纯 WASM，gzip ~30KB）。参数：`m=64MiB, t=2, p=1, salt=32B, 输出=64B`（前 32B = KEK，后 32B = V）。上线前在低端设备实测，>1s 则降 m 到 32MiB；参数存 `kdfParams` 版本化，调参无需迁移 |
| 3 | 迁移策略 | **不做应用内迁移**。V2 是破坏性更新，交付一份差异说明 + 一次性迁移脚本（见第 8 节） |
| 4 | 改密码后会话 | **保持登录**，不销毁 session（re-wrap 是 O(1)，销毁 session 是 O(n) 时代的历史包袱） |
| 5 | 手动迁移手段 | 提供一次性脚本 `scripts/migrate-v1-to-v2.mjs`（见第 8 节），用完即弃、不进 CI、不做兼容维护 |
| 6 | 密码强度校验 | 引入 `@zxcvbn-ts/core`，**动态 import 懒加载**（仅 init / 改密码页），评分 < 3 时展示破解时间估算并警告，**不拦截** |

### 评审中对原设计文档的三处修正

1. **"KDF 前后端必须同一实现"不成立**。新模型下主密码永不出前端，KDF 只在前端跑；后端只存 V 做 `SHA512(V + challenge)` 比对，对 KDF 零感知。后端因此**无任何新密码学依赖**。
2. **salt 由前端生成**（原文档写"后端生成"）。salt 只需唯一不需保密，前端 `crypto.getRandomValues(32)` 生成随 init/改密码一起提交，省一次往返，无安全差异。
3. **凭证 v2 密文格式去掉 salt 字段**。原格式 `v2:<alg>:<salt>:<nonce>:<ciphertext>:<tag>` 中的 salt 是多余的——DEK 是随机生成的，加密凭证不经过 KDF，没有 salt 存在的意义。见第 4 节。

## 2. 密码学核心流程

### 2.1 派生与存储总览

```
主密码（只在前端内存）
  └─ argon2id(password, salt, {m=64MiB,t=2,p=1}) → 64B
        ├─ [0:32]  = KEK  ── 仅前端内存，登录后解开 keyBlob 即可丢弃
        └─ [32:64] = V    ── hex 存 User.passwordHash；网络上传输的永远是
                             SHA512(V + challenge)，V 本身只在 init/改密码时
                             经 HTTPS 提交一次

DEK = crypto.getRandomValues(32)（init / 迁移脚本时生成一次，永不变更）
keyBlob = AES-256-GCM(KEK, DEK) → 存 User.keyBlob

凭证 content = AES-256-GCM(DEK, 明文, 随机 nonce) → v2 格式字符串
```

### 2.2 登录

```
前端：argon2id(密码, salt) → (KEK, V)
      hash = SHA512(hex(V) + challengeCode)
      POST /auth/login { hash }
后端：与现逻辑一致（challenge 校验、IP 锁定、失败通知全部保留），
      响应中新增下发 keyBlob
前端：KEK 解 keyBlob → AEAD tag 校验通过 → DEK 入内存（jotai，Uint8Array）
      （tag 校验失败 = 密码错误或数据被篡改，提示重新登录）
```

附带的免费收益：**AEAD tag 校验构成"解密即认证"的第二重确认**——后端即使被完全攻破返回伪造 keyBlob，篡改也会被检出。

### 2.3 初始化

```
前端：zxcvbn 强度提示 → salt = random(32B) → argon2id → (KEK, V)
      DEK = random(32B) → keyBlob = GCM(KEK, DEK)
      POST /auth/init { verifier: hex(V), salt, keyBlob, kdfParams }
后端：原样存储（现有 init 流程的字段替换，无新逻辑）
```

### 2.4 改密码（O(1) re-wrap）

```
前端：① 本地验旧密码：argon2id(旧密码, salt) → oldKEK → 解 keyBlob，
        AEAD tag 通过即正确（无需后端参与，替代旧 validateAesMeta）
     ② zxcvbn 校验新密码强度
     ③ newSalt = random(32B) → argon2id(新密码) → (newKEK, newV)
     ④ newKeyBlob = GCM(newKEK, DEK)   ← DEK 已在内存，凭证零改动
     ⑤ POST /auth/change-password { verifier: hex(newV), salt: newSalt,
                                     keyBlob: newKeyBlob, totp? }
后端：校验 session + challenge + TOTP（如启用）→ 更新 User 三行字段
      → **不销毁 session**
前端：内存 KEK 更新为 newKEK（或丢弃，留 DEK 即可）
```

### 2.5 密钥内存管理

- `stateMainPwd`（CryptoJS WordArray）废弃，替换为 `stateVault: { dek?: Uint8Array, kek?: Uint8Array }`。
- 登录解开 keyBlob 后 KEK 可丢弃（改密码只需 DEK + newKEK），减少内存中的密钥材料。
- logout / session 失效时 Uint8Array `.fill(0)` 后清空 atom。
- 密钥**永不**进 localStorage / IndexedDB / cookie。

## 3. 数据模型变更（Prisma）

```prisma
model User {
  // 语义替换：
  passwordHash String  // v2: hex(V)，V = argon2id 输出后 32 字节
  passwordSalt String  // v2: hex(KDF salt)，前端生成

  // 新增：
  keyBlob    String @default("")  // v2 格式：AES-256-GCM(KEK, DEK)
  kdfParams  String @default("")  // JSON: {"algorithm":"argon2id","m":65536,"t":2,"p":1,"version":1}
}

model Group {
  // 预留，一期不使用：
  keyBlob String?  // 二期方案 B：AES-256-GCM(KEK, 组DEK)
}
```

分组门禁（`Group.passwordHash` / lockType / unlock 接口）一期**原样保留**，其快速哈希可离线爆破的局限在二期方案 B 解决，本文不展开。

## 4. 密文格式（v2，版本化自描述）

```
凭证 content：v2:aes-256-gcm:<nonce_hex>:<ciphertext_hex>:<tag_hex>
keyBlob：     v2:aes-256-gcm:<nonce_hex>:<ciphertext_hex>:<tag_hex>
```

- nonce 96-bit 随机（每次加密独立生成），tag 128-bit。
- keyBlob 的明文内部布局为 `0x01 || DEK`（1 字节版本头 + 32 字节 DEK）；解包时首字节必须校验，不识别则抛专用错误。凭证 content 无此前缀。
- 一律 hex 编码，与现有存储风格一致，便于调试。
- 解析器按 `:` 切分并校验段数与前缀，格式非法直接抛错（不做静默兼容）。
- 未来扩展（xchacha20-poly1305 等）只需新增 `<alg>` 分支。

## 5. 前端改造清单

### 新增 `src/lib/e2ee/`（纯函数模块，全部配单测）

| 文件 | 内容 |
|------|------|
| `kdf.ts` | `deriveMasterKey(password, saltBytes, params) → { kek: Uint8Array, verifier: Uint8Array }`，基于 `hash-wasm` argon2id |
| `cipher.ts` | `encryptContent(dek, plaintext)` / `decryptContent(dek, v2字符串)` / `wrapDek(kek, dek)` / `unwrapDek(kek, keyBlob)`，基于 WebCrypto `AES-GCM` |
| `format.ts` | v2 格式编解码 + 校验 |
| `random.ts` | `randomBytes(n)` 封装 |

### 改造点

- **`utils/crypto.ts`**：删除 `getAesMeta` / `validateAesMeta` / `aes` / `aesDecrypt`；`sha512` / `createReplayAttackHeaders` 改用 `@noble/hashes`（SHA-512），**CryptoJS 整体移除**。
- **`store/user.ts`**：`stateMainPwd` → `stateVault`（见 2.5）。
- **`pages/init`**：走 2.3 流程；接入 zxcvbn 懒加载强度提示。
- **`pages/login`**：走 2.2 流程；KDF ~0.5s 期间按钮 loading 文案提示"密钥派生中"。
- **`pages/change-password`**：整体重写为 2.4 re-wrap 流程；删除 challenge+AES 加密旧密码的整个 postKey 构造。
- **凭证读写链路**（`certificate-list` 下所有用 `pwdKey/pwdIv` 加解密 content 的组件）：切到 `stateVault.dek` + `e2ee/cipher`。
- 新依赖：`hash-wasm`、`@zxcvbn-ts/core`、`@noble/hashes`；移除：`crypto-js`。

## 6. 后端改造清单

- **`lib/crypto/index.ts`**：删除 `getAesMeta` / `aesEncrypt` / `aesDecrypt`；`sha512` / `validateReplayAttack` 切到 `node:crypto`，**CryptoJS 整体移除**。后端零新密码学依赖。
- **`modules/auth/service.ts`**：
  - `init`：入参改为 `{ verifier, salt, keyBlob, kdfParams }`，原样存储；
  - `login`：校验逻辑不变（`SHA512(V + challenge)` 模式天然兼容），响应新增 `keyBlob`；
  - `changePassword`：删除整个 O(n) 重加密与 postKey 解密逻辑，改为校验 session + challenge + TOTP 后更新 `passwordHash/passwordSalt/keyBlob` 三字段，**不再销毁 session**。
- **`types/`（即前端 `@shared-types`）**：同步 init/login/change-password 的 schema。
- Prisma migration：新增 `User.keyBlob` / `User.kdfParams` / `Group.keyBlob`。

## 7. API 变更摘要

| 接口 | 变更 |
|------|------|
| `POST /auth/init` | `{ passwordHash, passwordSalt }` → `{ verifier, salt, keyBlob, kdfParams }` |
| `POST /auth/login` | 请求不变；响应 `data` 新增 `keyBlob`、`kdfParams` |
| `GET /auth/global` | 响应 `data` 新增 `kdfParams`（未初始化时缺省） |
| `POST /auth/change-password` | `{ a: encryptedData }` → `{ verifier, salt, keyBlob, totp? }` |
| 其余接口 | 不变（challenge、防重放 header、分组门禁、凭证 CRUD 语义全部保留） |

## 8. v1 → v2 数据结构差异与手动迁移

### 8.1 结构差异

| 位置 | v1 | v2 |
|------|----|----|
| `User.passwordHash` | `SHA512(salt + 主密码)` hex（快速哈希，可离线秒破） | `argon2id(主密码, salt)` 输出的后 32 字节 hex（慢 KDF 验证者 V） |
| `User.passwordSalt` | `nanoid(128)` | 32 字节随机 hex（前端 `crypto.getRandomValues`） |
| `User.keyBlob` | ❌ 不存在 | `v2:aes-256-gcm:...`，内含全局 DEK |
| `User.kdfParams` | ❌ 不存在 | `{"algorithm":"argon2id","m":65536,"t":2,"p":1,"version":1}` |
| `Certificate.content` | AES-256-CBC hex，key=MD5(密码)、iv=SHA256(密码) 确定性派生（同明文同密文，无认证）。注：MD5 hex 为 32 个 ASCII 字符即 32 字节 key，CryptoJS 按 key 长度自动选择 AES-256——早期文档中"AES-128"的描述有误，以实际代码行为为准 | `v2:aes-256-gcm:<nonce>:<ciphertext>:<tag>`，随机 DEK + 随机 nonce + AEAD 认证 |
| `Group` | 无密钥字段 | 新增 `keyBlob`（预留，一期为空） |

### 8.2 手动迁移：`scripts/migrate-v1-to-v2.mjs`

一次性 standalone Node 脚本（`node scripts/migrate-v1-to-v2.mjs <db路径>`）：

1. 复制原库为 `<db>.v1.bak`（强制备份，脚本自己先做）；
2. 交互式输入旧主密码，用 v1 规则 `SHA512(salt + 密码)` 校验输入正确；
3. 用 v1 派生（MD5/SHA256/AES-CBC，逻辑内嵌于脚本，crypto-js 仅脚本临时依赖）逐条解密 `Certificate.content`，**解密失败的条目打印警告、保留原文、跳过**（兼容现网脏数据，与旧 changePassword 的兜底策略一致）；
4. 生成新 salt → argon2id → (KEK, V)；生成 DEK → keyBlob；全部凭证重加密为 v2 格式；
5. 单事务写回 User 四字段 + 全部凭证；
6. 打印迁移报告（成功/跳过条数），提示重启服务后用旧密码无法登录、需用同一主密码登录（V 已替换）。

脚本复用前端 `e2ee` 模块的格式逻辑（经 `node --import tsx` 运行，hash-wasm/WebCrypto 在 Node 可直接使用），保证写出的 v2 密文与正式代码完全一致。**定位：用完即弃，不进 CI，不做兼容维护。**

> **部署顺序**：先执行 `prisma migrate deploy`（T02 的 add_key_blob_v2 迁移）再跑本脚本。脚本对新列存在幂等；若顺序颠倒（脚本先行加列），migrate deploy 会因列重复而失败。

## 9. 实施步骤（依赖排序，每步可独立验收）

1. **前端 `e2ee` 核心模块**（kdf/cipher/format/random）+ 单测：argon2 输出长度与拆分、v2 格式 round-trip、AEAD 篡改必失败、错误格式抛错。
2. **Prisma schema 变更 + migration**。
3. **后端 auth 重写**（init/login/changePassword）+ crypto 模块清理（node:crypto）+ shared types 同步。
4. **前端 init/login/change-password 三页改造** + `stateVault`。
5. **凭证读写链路切换**（certificate-list 全部加解密点）。
6. **zxcvbn-ts 接入**（init / change-password，懒加载）。
7. **迁移脚本 + 本文档第 8 节核对**。
8. **e2e（Playwright）更新**：登录/初始化流程适配 KDF 等待；移除 CryptoJS 依赖；`crypto.test.ts` 扩展覆盖新模块。

## 10. 测试要点

- 单测：e2ee 四模块 round-trip / 篡改检测 / 格式校验；后端 `SHA512(V + challenge)` 与前端 `@noble/hashes` 输出一致性（跨实现向量对拍）。
- 流程：init → login → 增删改查凭证 → 改密码 → **不重新登录**继续操作 → 重登录验证新 V 生效、旧 V 失效。
- 回归：登录失败锁定 / 异地登录通知 / TOTP 联动 / 分组门禁 / 防重放 header 全部不变。
- 迁移脚本：构造含脏数据的 v1 库，验证跳过策略与备份文件生成。

## 11. 安全边界（沿用设计文档，不重复论证）

- 前端代码被篡改（供应链/XSS）无法防御，信任锚 = 前端代码 + 主密码强度。
- 极弱主密码靠 zxcvbn 提示缓解，无法根治。
- V 在 init/改密码时经网络传输一次，依赖 HTTPS 作为传输信任锚（与 v1 init 传 passwordHash 同级）。
- 浏览器内明文环节（键盘记录/截屏）无法防御。
