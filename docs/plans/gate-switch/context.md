# 设备门开关（Gate Switch）

## 1. 背景与目标

device-gate 批次落地后，门的启停语义绑定在「trusted-devices.json 非空」上（文件即开
关）。用户产品决策：设备管理页应有一个**显式开关**，默认 OFF；开关状态存 AppConfig
（`deviceGateEnabled`），**开关切换不改动 trusted-devices.json**——文件只做设备清单，
开关只做门的开闭，职责分离。

门禁判定语义变更（用户拍板，单条件 fail-closed）：

```
isGateEnabled() = AppConfig.deviceGateEnabled === true    ← 唯一判定
```

- ON + 文件空 = 拦截一切（无人能过门）——fail-closed，不给静默降级到纯密码的路径；
  正常 UI 流程到不了这个状态（首开必须绑设备），进入该状态只有手工改 AppConfig 或
  「门开时吊销光全部设备」——后者在 UI 上 confirm 明示后果，逃生门 = 关开关
- 开关 OFF + 文件有设备 = 不拦（设备清单原样保留，临时排查场景）

**非目标**：
- 不改 verify/challenge/add/list/revoke 接口契约与 WebCrypto 链路
- 不改 AGENTS.md 已记录的设备门词条中除判定语义外的内容（词条随本批次更新）
- 不做开关的操作审计日志（通知系统已有敲门通知，够用）

## 2. 方案概要（已敲定决策）

1. **AppConfig 键**（D-config）：`deviceGateEnabled`，值 `"true"`/`"false"` 字符串
   （AppConfig.value 是 String 列），缺省视为 false。经现有 `AppConfigService` 读写，
   不新建表。
2. **后端判定改造**（D-backend）：`lib/device-store` 的 `isGateEnabled()` 改为读
   AppConfig——但这引入 lib 层对 Prisma 的依赖，与 device-store 现有纯文件实现冲突。
   采用**依赖注入**：`DeviceService` 构造时接收 `gateEnabledSource: () => boolean`
   （由 register-service 组装为读 AppConfig 的同步函数，AppConfig 极小可全量缓存，
   或直查——单人场景直查即可）；`lib/device-store` 保留文件读取原语
   （`hasDevices()`），供 UI 展示与绑定守卫使用。**门禁 hook 的判定改为调
   DeviceService.isGateEnabled()**（统一入口，不出现两处判定逻辑）。
   - `getChallenge` 响应的 `gateEnabled` 下发同步走新判定
   - `/device/add` 增加守卫：`gateEnabled === false && devices.length === 0` 时放行
     （首台绑定）；`gateEnabled === false && devices.length > 0` 时放行（开关关着
     允许预绑定）；`gateEnabled === true` 时要求 session（现状）——即 add 不受开关
     限制，只受 session 限制，保持现状语义不变
3. **开关接口**（D-switch-api）：复用现有 app-config 模块风格新增两个 session 路由
   （挂 device 模块或 app-config 模块，按内聚选 device 模块）：
   - `POST /device/gate-config` 读：`{ enabled: boolean, deviceCount: number }`
   - `POST /device/gate-config-update` 写：`{ enabled: boolean }`——写 AppConfig；
     **开启约束**：`enabled: true` 时若 `devices.length === 0` 返回 400
     「请先绑定至少一台设备」（后端守卫，前端按钮同步置灰双保险）
4. **前端设备管理页改造**（D-ui）：
   - 顶部 Switch「仅授权设备允许登录」，初始态由 gate-config 拉取
   - OFF：Switch 下方无任何内容
   - ON 首次（enabled=false 且 devices 空）：展示引导卡（①生成本机钥匙串 ②[保存并
     启用] 按钮——钥匙串未生成时置灰）；点击保存 = /device/add 绑首台 +
     gate-config-update {enabled:true}（两次调用，先 add 后 update，失败各自报错，
     add 成功而 update 失败时设备已入库但门仍关——无害状态，重试即可）
   - ON 已启用：现有完整内容（设备列表/录入其他设备/吊销）
   - 关闭：confirm（「关闭后任何知道地址的设备都能尝试登录」）→ update false，
     设备列表不动；UI 回到 OFF 态
   - 吊销最后一台设备时：confirm 文案追加「这是最后一台受信设备，门开启状态下移除
     后将无人能通过设备验证（恢复方式：关闭设备门开关）」——允许操作
5. **AGENTS.md 词条更新**（D-docs）：设备门词条的「文件非空即门生效」改为
   「AppConfig deviceGateEnabled 为唯一开关；trusted-devices.json 仅为设备清单」；
   Principle 无新增。

## 3. 公共上下文

### 现状关键文件

| 关注点 | 文件 |
| --- | --- |
| 现判定（要改） | `backend/src/lib/device-store/index.ts` isGateEnabled + 全部调用方 |
| DeviceService | `backend/src/modules/device/service.ts`（getChallenge 的 gateEnabled 下发） |
| 门禁 hook | `backend/src/app/register-service.ts:100-113` |
| app-config 模块 | `backend/src/modules/app-config/{controller,service}.ts`（AppConfigService 读写范式） |
| 前端管理页 | `frontend/src/pages/device-manage/content.tsx`（SettingContainer 内容） |
| 前端 device services | `frontend/src/services/device.ts` |
| 集成测试 | `backend/src/app/device-gate.integration.test.ts`（门激活态的构造方式要适配） |
| e2e | `packages/e2e/tests/device-gate.spec.ts` + `fixtures/device-gate.ts`（TRUSTED_DEVICES 文件直写构造门激活态——需同步改为「写文件 + 置 AppConfig」或经 API） |

### 已知的坑

- `isGateEnabled()` 当前是同步函数且被门禁 hook 每请求调用；AppConfig 读取是异步
  Prisma 调用。方案：register-service 启动后把 `gateEnabledSource` 实现为「内存
  缓存 + gate-config-update 时同步失效」——或更简单：hook 内 await 一次
  `appConfigService.get('deviceGateEnabled')`（单人每请求多一次主键查询，SQLite
  本地微秒级，可接受）。**选后者**（无缓存失效复杂度）。
- e2e fixtures 的 `writeTrustedDevices` 直写文件构造门激活态——新语义下还要置
  AppConfig；fixtures 统一封装 `enableGate(page/request)` helper：API 登录 →
  add 设备 → gate-config-update true。凡原「写文件即激活」的用例改走 helper。
- 集成测试（backend）同构：临时库 + buildAppWithPrisma，门激活态构造改为两步。
- `/device/add` 在门 ON 时的自我授权（本机 session）语义不变；门 OFF 时同样允许
  （预绑定）——注意 gate-config-update 的守卫是「开启前必须有设备」，不是 add 加锁。
- 前端「保存并启用」的两步调用顺序必须 add 在前（update 的后端守卫依赖设备已入库）。

## 4. 端到端验收

一段话：默认全新部署设备管理页只见 OFF 开关；开启流程引导绑定首台设备后保存，门激活
（登录页探针 gateEnabled=true）；关闭开关立即生效（探针 false）且设备清单保留；门开时
吊销最后一台设备有明确警告，确认后门仍开（无人能过门）直至手动关开关；全部既有
device-gate e2e 在新构造方式下绿；backend/frontend/e2e 全量绿。

验证命令：

```sh
pnpm --filter backend test && pnpm --filter frontend test
pnpm lint
E2E_BACKEND_PORT=13499 E2E_FRONTEND_PORT=13500 pnpm test:e2e
```
