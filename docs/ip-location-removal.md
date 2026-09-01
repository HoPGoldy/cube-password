# 移除 ip2region 地理转译与异地登录检测：方案 B+（最终版）

> 状态：已实施（2026-09，见 commit `035711f`、`7f14a9d`、`7ca7c2f`）
> 决策：「异地登录检测」与登录环节 TOTP **整个移除**；地理转译（ip2region）整体移除；安全审计只保留 IP 原始事实。

## 1. 背景与目标

- `resources/ip2region.xdb` 占 **10.6MB**，Dockerfile 有专门 `COPY` 它的逻辑（git 历史上已为此修过两次路径问题），维护成本与镜像体积不值当；
- ip2region 的地址结果经常不准，对"判断是否本人登录"帮助有限；
- 单用户自部署场景，安全审计真正需要的信息就是 **IP**，地理转译是锦上添花且不可靠的派生转译。

**目标：**

1. 整体移除 ip2region 地理转译（库、数据文件、Dockerfile COPY、配置项）；
2. 「异地登录检测」整个移除（原方案 A 的 IP 直比已放弃）；
3. 登录环节的 TOTP 校验随检测一并移除（它原本只在异地分支触发）；TOTP 继续服务于分组解锁与改密；
4. `User.commonLocation` 字段通过 migration 删列；
5. 登录失败记录（LoginFailRecord）删除 `location` 字段，前端改展示已有的 `ip` 字段。

**非目标（明确不动）：** TOTP 分组解锁（`lockType === "Totp"`）、改密时的 TOTP 校验、OTP 绑定/解绑模块、登录失败锁定机制（一天 3 次）、challenge 机制。

## 2. 方案比选

| 方案 | 内容 | 异地登录检测 | 登录 TOTP |
|------|------|-------------|-----------|
| A（已否决） | 删 ip-location 模块，`commonLocation` 语义改为"常用 IP"，异地检测改为 IP 字符串直比 | 保留（信息从城市 → IP） | 保留 |
| B+ ✅（最终实施） | 连异地登录检测一起删，登录 TOTP 随之删除，`commonLocation` 删列 | 删除 | 删除（TOTP 保留于分组解锁与改密） |

否决 A 的理由：

1. IP 直比后，家庭宽带 PPPoE / 手机 4G 的出口 IP 漂移会使"异地"误报频率比按城市判断更高——信息粒度变细，可靠性反而更差，检测本身失去意义；
2. 单用户自部署场景，成功登录通知信噪比低；登录安全已有**失败通知 + 失败锁定（一天 3 次）+ challenge** 兜底；
3. 登录 TOTP 原本只在异地分支触发，检测删除后无处触发，随之退役；TOTP 的设计重心是分组级保护（攻击者拿到主密码也解不开 Totp 锁定的分组），该价值不受影响。

**设计原则：安全审计只记录原始事实（IP），不做不可靠的派生转译。** IP 是请求自带的客观事实；城市/地区是从 IP 派生的、依赖第三方数据且经常出错的转译结果，不进库、不进通知。

## 3. 改动清单（已全部落地）

### 3.1 后端逻辑（commit `035711f`）

- 删除 `modules/auth/service.ts` login() 内的异地检测分支：`queryIp` → `isSameLocation` → 无 TOTP 发通知 / 有 TOTP 抛 `ErrorNeedTotpCode`（共约 60 行）；
- 删除登录成功后的 `commonLocation` 更新逻辑；
- `login(hash, ip)` 签名去掉 `code` 参数，不再 `verifySync`（改密分支的 `generateSync` 保留）；
- 删除 `ErrorNeedTotpCode`（HTTP 错误码 **40103** 随之退役）；
- 通知调整：
  - 登录成功：**无通知**；
  - 密码错误：「`${ip} 在登录时输入了错误的密码…`」——保留，只含 IP；
  - 非法登录（challenge 无效/过期）：保留，不含地理信息；
- `login-locker`：`LoginFailRecord` 去掉 `location` 字段，`recordLoginFail(ip)` 单参数（测试同步更新）；
- 删除 `lib/ip-location/`（`index.ts` + `ip2region.ts`）与 `config/path.ts` 中 `PATH_IP2REGION`；
- 登录请求体 `SchemaAuthLoginBody` 去掉可选 `code` 字段；`SchemaLoginFailRecord` 去掉 `location`。

### 3.2 数据与构建（commit `7f14a9d`）

- `schema.prisma`：`User.commonLocation String @default("")` 删除；
- migration `20260901123606_remove_common_location`：SQLite 重建表删列（该字段无前端/API/其他模块暴露，僵尸列无保留价值）；
- 删除 `resources/ip2region.xdb`（10.6MB）；
- `Dockerfile`：删除 `COPY packages/backend/resources/ip2region.xdb ...` 一行。

### 3.3 前端（commit `7ca7c2f`）

- `pages/login/page.tsx`：
  - 删除动态码输入框及 `resp.code === 40103` 触发逻辑，登录请求只传 `{ hash }`；
  - 失败记录文案 `"于 " + item.location` → `"于 " + item.ip`（展示真实 IP）；
- `types/auth.ts`：`LoginFailRecord` 去掉 `location` 字段；
- 分组配置、OTP 绑定页、改密页的 TOTP 依赖（`withTotp` 等）不受影响。

### 3.4 测试与回归

- `login-locker/index.test.ts`：随 `recordLoginFail` 单参数签名更新；
- e2e：不依赖 location / ip2region / 登录 TOTP，无改动；
- 回归重点：密码错误 → 通知 + 锁定计数、challenge 失效 → 非法登录通知、分组 Totp 解锁、改密 TOTP 校验。

## 4. 风险与边界

- **失去异地提醒能力**：从异地 IP 登录成功时不再有任何通知。已接受——失败/非法登录仍有通知 + 锁定兜底，且 Totp 锁定分组在主密码泄露时依然安全；
- **无地理信息回退路径**：`commonLocation` 已物理删列，若未来需要地理信息需重新建列并引入数据源（如 HTTP 免费 API），且应遵循"原始事实入库、派生转译仅展示"的原则；
- **已部署实例升级**：migration 自动删列，`User` 表中的历史常用登录地数据随之丢弃，无兼容负担（该数据从未对外暴露）。
