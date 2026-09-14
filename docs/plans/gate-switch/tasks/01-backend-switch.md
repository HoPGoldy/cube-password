# T01: 后端判定改造 + 开关接口

## 目标

isGateEnabled 语义从「文件非空」改为「AppConfig deviceGateEnabled」（单条件
fail-closed）；新增 gate-config 读/写接口（含开启守卫）；门禁 hook 与 challenge
探针统一切到新判定；集成测试的门激活态构造适配。

## 上下文

- context.md 第 2 节 D2/D3 与已知的坑第 1 条
- 源码：lib/device-store/index.ts、modules/device/{service,controller,types}.ts、
  app/register-service.ts、modules/app-config/service.ts、
  app/device-gate.integration.test.ts

## 边界

- 上述后端文件 + types/device.ts（新 schema）
- lib/device-store：isGateEnabled 改造为 hasDevices（保留文件原语），导出面更新
- 不动前端（T02）、不动 e2e fixtures（T03）

## 验收

- POST /device/gate-config（session）：返回 { enabled, deviceCount }，空库默认 false/0
- POST /device/gate-config-update（session）：开启且无设备 → 400；正常切换落
  AppConfig；下次 gate-config 读到新值
- 门禁 hook 判定走新语义：集成测试覆盖「enabled=true + 文件空 → 预登录路由 403」
  （fail-closed 格子）与「enabled=false + 文件有设备 → 放行」
- /device/challenge 的 gateEnabled 下发与 hook 判定一致
- /device/add 语义不变（session 即可，与开关状态无关）
- pnpm --filter backend test 全绿（含适配后的集成测试）；build/tsc 过

## 依赖

无
