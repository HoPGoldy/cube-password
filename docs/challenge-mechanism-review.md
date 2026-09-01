# 挑战码（Challenge）机制审查

> 状态：审查报告（2025）
> 范围：`packages/backend/src/lib/challenge` + 登录 / 分组解锁 / 改密码 / 解绑 TOTP 四个入口

## 0. 约束假设（先于一切结论）

本应用的设计核心是**单用户、单会话、个人自部署**（sqlite + 单进程 + 内存 session）：

- 不存在多用户并发；攻击面只有「本人设备 + 可访问部署地址的外部攻击者」；
- 网络攻击（暴力破解、刷接口）已有 `login-locker` 的 IP 锁定兜底；
- 服务重启属正常运维操作，前端每次都现取 challenge 可自愈。

**下列所有条目的严重度均按该前提评估**。若未来走向多用户/多副本，需重新审查。

## 1. 现状盘点

### 1.1 ChallengeManager 实现（`lib/challenge/index.ts`）

```ts
generateChallenge(): string        // 生成 nanoid(32)，塞入全局 Map，5 分钟过期清理
validateChallenge(code): boolean   // 按 code 精确匹配 + 删除（一次性）+ 过期检查
popLastChallenge(): string|undefined  // 找 createdAt 最新的一条 + 删除 + 过期检查
```

Map 全局单例，**所有接口共用一个池**。

### 1.2 四个使用场景（两种截然不同的消费模式）

| 场景 | 前端拿 challenge 后 | 后端消费方式 | 是否正确 |
|------|--------------------|--------------|---------|
| 登录 `auth/login` | `hash = SHA512(SHA512(salt+pwd) + challenge)` 随请求发送 | `popLastChallenge()` 取最新，比对 `SHA512(user.passwordHash + challenge)` | ⚠️ 推断式 |
| 解锁分组 `group/unlock` | 同上，`SHA512(sha512(group.salt+code) + challenge)` | `popLastChallenge()` 取最新比对 | ⚠️ 推断式 |
| 改密码 `auth/change-password` | `postKey = sha512(salt+oldPwd) + challenge + token + totp` → AES 加密 `{old,new}` 随请求发送 | `popLastChallenge()` 取最新，重构 postKey 解密 | ⚠️ 推断式 + 密钥材料 |
| 解绑 TOTP `otp/remove` | 把 `challengeCode` **明文字段**随请求回传 | `validateChallenge(code)` 精确校验 | ✅ 显式式 |

## 2. 问题清单

### P1（低）`popLastChallenge()` 取"最新"存在竞态，且不绑定请求者
前端每次操作前紧邻取 challenge，但服务端消费的是"**Map 里时间最新的一条**"，与被校验请求本身无关联。

单用户前提下：两个标签页或手机+桌面同时操作时仍可能互相 pop，偶发静默失败（登录报"挑战码无效"、改密码解密失败）。概率低、重试可自愈，**不是安全漏洞**，属于体验层偶发问题。

> 之所以值得修：不是因为它有安全影响，而是「取最新」是猜测式逻辑，改成显式回传成本低、收益确定性，且能消掉一类难以排查的偶发失败。

### P2（低-中）全局共享池，跨接口互抢
同一池同时服务登录/解锁/改密码/TOTP 解绑，`popLastChallenge` 不区分用途。虽然前端时序上通常能碰对，但技术上完全无隔离，配合 P1 放大风险。

### P3（低）两种消费模式不一致
三个接口用推断式、一个接口用显式式，同一代码库两种心智模型，改一处容易漏另外三处。`otp/remove` 已经是正确答案，其余三个应向它看齐。

### P4（中，违背自身设计原则）改密码时 challenge 充当"密钥材料"，使后端能解密明文
`postKey = hash + challenge + token + totp` 中所有成分后端都能重构，因此**后端可以解开 `{oldPassword, newPassword}` 的密文**。

单用户前提下：后端管理员 = 用户本人，泄露面是「部署者对自己信息的可见性」，不构成外部攻击面。但它**违背了应用「后端只碰密文、主密码不出前端」的核心设计承诺**——这是接受权衡下的已知妥协，不是漏洞。

> 用户侧决策：作者已明确接受「更改主密码是极小概率事件，明文过端可接受」。
> 密钥分层改造（`key-hierarchy-design.md` §4）可让它顺带消失且 O(1)，属于改造附赠收益，不单独驱动改造。

### P5（低，可忽略）哈希拼接而非 HMAC，且依赖全局大写约定
`SHA512(passwordHash + challenge)` 语义接近 HMAC 但无密钥分离；前端 `toString().toUpperCase()` 与后端 `enc.Hex` + uppercase 恰好一致，属于隐性约定，将来重构易踩坑。防重放强度本身够（challenge 随机性足），单用户前提下重构风险可忽略。

### P6（可接受）内存态：重启即全部失效
服务重启后所有 challenge 作废。前端每个操作前都重新取 challenge，能自愈；单用户自部署无多副本场景。可接受，无需处理。

### P7（可接受）challenge 获取无频率限制
`generateChallenge` 可被随意刷取（内存 Map 被塞满，5 分钟才清理）。单用户前提下唯一风险是外部攻击者刷池做小规模 DoS，影响仅"几 MB 内存 + 争取几秒"，且有 login-locker 兜底。可接受，无需处理。

## 3. 建议方案

### 方案 A（短期，最小改动）：统一为"显式回传 + 用途隔离"

1. 所有需要 challenge 的请求（登录 / 解锁 / 改密码 / 解绑 TOTP）**body 显式携带 `challengeCode`**，废除 `popLastChallenge` 推断式消费。
2. `generateChallenge(purpose)` 生成时带用途前缀（如 `auth:login:xxx`、`group:unlock:<id>:xxx`），`validateChallenge(code, expectedPurpose)` 校验用途匹配，跨接口无效。
3. challenge 与已登录 session 绑定（`Map<purpose+sessionToken, entry>`），改密码/解锁场景只认自己 session 的挑战码。

改动集中在 ChallengeManager + 三个 controller，不碰数据模型，可立即消除 P1/P2/P3。

### 方案 B（中长期，随密钥分层改造一起做）：无状态挑战码

```
challenge = base64url(payload) + "." + HMAC-SHA256(serverSecret, payload)
payload   = { purpose, nonce, expires, session? }
```

- 服务端**不存池**：验签（serverSecret）+ 校验过期时间 + 校验 purpose 即完成，天然无竞态、重启不失效、支持多副本；
- 登录 / 解锁 / 改密码使用不同 purpose，跨用途无效；
- `serverSecret` 走环境变量（参考现有 `BACKEND_JWT_SECRET` 的思路），未配置时启动自生成并持久化到 sqlite（避免重启漂移）；
- 密钥分层改造后 `changePassword` 已不把 challenge 当密钥材料，此处只做防重放，职责干净。

### 建议时间线（单用户前提下的优先级）

| 阶段 | 动作 | 优先级 |
|------|------|--------|
| 随缘/顺手 | 方案 A：统一为显式回传（消除 P1 偶发失败 + P3 心智不一致） | 低——收益确定性，但不紧急 |
| 密钥分层改造时 | 方案 B：无状态 challenge；同时删除 changePassword 的 challenge-密钥派生逻辑（P4 随改造消失） | 中——随主改造附赠 |
| 不做 | P5/P6/P7：单用户前提下均为可接受权衡 | — |