# T05: e2e：WebCrypto 钥匙全链路

## 目标
新增 `packages/e2e/tests/device-gate.spec.ts`，覆盖设备门完整生命周期作为特性端到端验收：门未激活回归、绑定首台设备、静默过门登录、门禁拦截、通知去重、文件手工编辑即时生效、吊销。不需要虚拟认证器——测试内直接用 WebCrypto 生成密钥。

## 上下文
context.md 第 4 节（端到端验收场景）、3.6（e2e 注意事项）。
阅读源码：`packages/e2e/playwright.config.ts`（webServer 探针、globalSetup）、`global-setup.ts`（需补 trusted-devices.json 清理）、现有 spec（`api-auth.spec.ts`、`auth.spec.ts`）的登录辅助流程。
钥匙注入方式：`page.evaluate(() => crypto.subtle.generateKey(...))` 在页面上下文生成密钥并存入 IndexedDB（复用 T03 `lib/device-key.ts` 的逻辑），或对 `/device/verify` 直接构造签名请求。注意 playwright 的 chromium context 是安全上下文，`crypto.subtle` 可用。
注意 workers=1 串行；需要门激活的用例与需要门未激活的回归用例之间，务必通过直接写/删 `packages/backend/storage/trusted-devices.json` 显式切换门状态。

## 边界
允许新增：`tests/device-gate.spec.ts`、e2e 内辅助函数；允许修改：`global-setup.ts`（清理设备文件）、`playwright.config.ts`（如需调整，探针 403 即就绪）。禁止修改后端/前端源码——e2e 发现的缺陷回流到对应任务修。

## 验收
`pnpm -w test:e2e` 全绿，包含场景：①门未激活时全部旧用例回归通过；②页面生成钥匙 + 管理页录入后 storage 文件生成；③无钥匙的新 context 访问 `/api/auth/global` 得 403、敲门失败，两次敲门通知列表仅 1 条 Warning；④有钥匙的 context：登录页加载即静默过门显示密码表单 → 登录成功进入首页；⑤吊销设备后再 verify 得 403；⑥运行中手工清空 devices → 门立即失效、纯密码登录可用。

## 依赖
T03（管理页 UI）、T04（登录门禁流程）
