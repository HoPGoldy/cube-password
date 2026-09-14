# T03: e2e 适配 + 全链路用例 + 文档收尾

## 目标

e2e fixtures 的门激活态构造改为「写文件 + 置 AppConfig」新语义；补开关生命周期用例；
AGENTS.md 设备门词条更新；全量收口。

## 上下文

- context.md 第 2 节 D5 与已知的坑第 2 条
- 源码：packages/e2e/fixtures/device-gate.ts（writeTrustedDevices 及全部用例的激活
  构造）、tests/device-gate.spec.ts、AGENTS.md

## 边界

- packages/e2e/**、AGENTS.md（仅设备门词条段）
- 现有用例行为断言不变，只改激活态构造方式

## 验收

- fixtures 提供 enableGate helper（API: add 设备 + gate-config-update true），
  原直写文件的激活用例全部切换
- 新用例：①空库 UI 开关 OFF 无内容 → 引导绑定 → 保存启用 → 探针 true；②关闭开关
  → 探针 false 且设备清单保留；③门开吊销最后一台 → 403 全拦（fail-closed 格子）
- AGENTS.md 词条与新语义一致（文件=清单，AppConfig=开关）
- E2E_BACKEND_PORT=13499 E2E_FRONTEND_PORT=13500 pnpm test:e2e 全量绿（含既有
  73 条）；backend/frontend test 绿；lint 绿

## 依赖

T01、T02
