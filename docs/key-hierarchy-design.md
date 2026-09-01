# 密钥分层（KDF / KEK / DEK）设计方案

> 状态：设计草案（2025 讨论产出）
> 关联讨论：BitLocker 密钥分层原理 → cube-password 现状差距 → 本方案

## 1. 背景与现状问题

当前 cube-password 的加密模型是**单层密钥**：

```
主密码
  ├─→ SHA512(salt + password) → User.passwordHash（登录验证）
  └─→ getAesMeta(password)
        ├─ key = MD5(password) hex 的 UTF8 前 16 字节（AES-128）
        └─ iv  = SHA256(password) hex 的 UTF8 前 16 字节
              └─→ AES-CBC + PKCS7 加密每张凭证 → Certificate.content
```

四个核心缺陷：

| # | 缺陷 | 后果 |
|---|------|------|
| 1 | **无 KDF**：密钥由 MD5/SHA256 直接派生，SHA512 用于存储验证 | 数据库被拖走后主密码可离线秒破（GPU 每秒数十亿次） |
| 2 | **无主密钥层**：凭证直接用主密码派生密钥加密，无 DEK | 改密码必须 O(n) 全盘重加密，且需要把明文密码传到后端 |
| 3 | **IV 无随机性**：key/iv 均由密码确定性派生 | 相同明文的凭证密文相同，CBC 泄露明文模式；全库共用 iv |
| 4 | **无认证加密** + 密文无版本号 | 密文可被静默篡改；算法升级无路可走 |
| 5 | 分组"加密"只是 session 门禁，分组密码不参与内容加密 | 分组间无真实数据隔离，数据库泄露即全量暴露 |

## 2. 目标架构（Bitwarden 标准模型）

```
主密码（只存在于用户脑子和前端内存，永不传输）
   │
   └─→ KDF（Argon2id / PBKDF2 高迭代，单次 0.3~1s）
        │
        ├─→ 验证者 V ──── 存后端，登录校验 / 失败锁定 / 异地登录检测
        │                 （慢 KDF 输出，离线猜一次同样要跑满 KDF）
        │
        └─→ KEK（密钥加密密钥）── 只在前端内存
              │
              └─→ 包裹 DEK（数据密钥，随机生成一次）
                    │
                    └─→ AES-256-GCM 加密每张凭证（随机 nonce）
```

### 2.1 与 BitLocker 的对应关系

| BitLocker | cube-password |
|-----------|---------------|
| FVEK（全卷加密密钥） | DEK（每分组/全局数据密钥） |
| VMK（卷主密钥） | KEK（包裹 DEK 的密钥） |
| protector（密码/TPM） | 主密码经 KDF 派生 |

改主密码 = 只重新包裹 DEK（O(1)），这正是 BitLocker 换密码不重加密全盘的同款原理。

## 3. 核心设计决策

### 决策 1：一次 KDF 派生，两个用途

```
KDF(主密码, salt, 参数) → 64 字节输出
                            ├─ 前 32 字节 = KEK（解密 keyBlob 用，不出前端）
                            └─ 后 32 字节 = V（登录校验用，存后端）
```

- V 与 KEK 同源但互不可推导（哈希单向性），后端有 V 也无法解开任何内容。
- 不重复计算 KDF；参数（算法 / 迭代 / salt）**版本化存库**，升级兼容。

### 决策 2：DEK 必须持久化，但永不裸存

- 密钥不能出前端（设计红线），但 DEK 必须跨会话存活（否则加密数据无法找回）。
- 解法：DEK 以 `keyBlob = AEAD_encrypt(KEK, DEK)` 密文形式存库。
- keyBlob 粒度决定隔离强度：
  - **方案 A（全局 1 个 DEK）**：所有分组同一把钥匙，等价于现状的门禁。
  - **方案 B（每分组 1 个 DEK）**：分组真隔离 —— 数据库泄露时 A 组密钥不影响 B 组；未解锁分组的 DEK 不在前端内存，XSS 也偷不到。

### 决策 3：保留慢 KDF 验证者 V（不采用"解密即认证"）

- "解密即认证"与"存慢 KDF 验证者"在离线爆破成本上**完全等价**（攻击者的验证载体都是要跑满 KDF 的东西）。
- 保留 V 才能继续支持现有：登录失败锁定、异地登录检测、TOTP 联动、安全通知。
- `passwordHash` 语义替换为慢 KDF 派生的 V，不再存快速可爆破的 SHA512。

## 4. 数据流（改造后）

### 登录
```
前端：输入主密码 → KDF → (KEK, V)
      V 经 challenge 混合后发给后端校验；KEK 留在前端内存
```
### 查看凭证
```
前端：请求凭证 → 后端返回【凭证密文 + keyBlob】（全是密文，后端不解密）
前端：KEK 解开 keyBlob → DEK（仅首次，随后缓存在内存）
      DEK 解开凭证密文 → 明文只在浏览器展示
```
### 改密码（O(1)，明文密码不出前端）
```
前端：newKEK = KDF(newPassword, salt)
      newBlob = AEAD_encrypt(newKEK, DEK)   ← DEK 已在内存
      POST /auth/change-password { newBlob, 验证者V' }
后端：校验 session + TOTP → 更新 keyBlob 与 V' 两行数据
      凭证内容零改动
```
### 分组解锁（方案 B）
```
前端：输入分组密码 → KDF → 解开 该分组 keyBlob → 组 DEK 入内存
后端：只做校验，不接触任何密钥
```

## 5. 数据模型 diff（Prisma）

```prisma
model User {
  // 现有字段保留，替换语义：
  passwordHash String   // 改为 KDF 派生的验证者 V（不再存 SHA512(salt+pwd)）
  passwordSalt String   // KDF 用的 salt（由后端生成，非前端）

  // 新增：
  keyBlob     String    // AEAD_encrypt(KEK, 全局DEK)  —— 方案 A 兜底
  kdfParams   String    // JSON: { algorithm, iterations, ... } 版本化
}

model Group {
  // 方案 B 新增：
  keyBlob     String?   // AEAD_encrypt(KEK, 组DEK)；lockType=NONE 时为空
}

model Certificate {
  content String  // 迁移为 v2 格式（见下）
}
```

## 6. 密文格式（版本化，自描述）

```
凭证内容：  v2:<alg>:<salt>:<nonce>:<ciphertext>:<tag>
            例： v2:aes-256-gcm:ab12...:9f2e...:3c70...:81d4...
keyBlob：   v2:<alg>:<nonce>:<ciphertext>:<tag>
```

- `<alg>` 可扩展（aes-256-gcm 起步，未来可加 xchacha20-poly1305）。
- 旧 `v1`（MD5/AES-CBC hex）由迁移脚本读取并升级。

## 7. 迁移方案（一次性，有 UX 成本）

1. 用户在「设置 → 数据迁移」输入旧主密码。
2. 前端用旧派生逻辑解出全部 v1 凭证 → 生成随机 DEK → 重加密为 v2 → 上传。
3. 前端按新 KDF 派生 (KEK, V) → 生成 keyBlob → 上传。
4. 后端更新 User.passwordHash/passwordSalt/keyBlob/kdfParams，切换标志位。
5. **迁移前必须强制备份提示**（一旦 v1 阶段结束，旧密码无法再解密数据）。

## 8. 安全边界（诚实声明）

- 完全攻破后端且篡改前端代码（供应链/XSS）→ 无法防御，E2EE 信任锚在前端代码 + 主密码强度。
- 极弱主密码（纯数字/常见词）→ 再慢的 KDF 也挡不住，init/改密码时做强度校验（建议引入 zxcvbn）。
- 浏览器可见明文环节（键盘记录 / 截屏）无法防御。

## 9. 落地步骤（依赖排序）

1. 密文格式 v2 + DEK 生成/加解密单元（前后端同构 + 单测锁定）。
2. KDF 层：`deriveMasterKey(password, salt, params)`，替代 `getAesMeta` / `shaWithSalt`；前后端**必须同一实现同一参数**（前端 WebCrypto PBKDF2 或 noble-argon2 纯 JS；后端 node:crypto / @node-rs/argon2）。
3. 数据模型变更 + 迁移脚本。
4. 登录/认证走新 V。
5. 改密码流程重写为 re-wrap 方案（删除 `changePassword` 的 O(n) 重加密）。
6. 分组方案 B（可选二期）。
7. 清理旧的 MD5/SHA512 派生路径，扩展 `crypto.test.ts`。