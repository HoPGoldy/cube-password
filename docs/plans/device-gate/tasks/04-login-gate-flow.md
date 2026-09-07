# T04: 登录页门禁流程改造

## 目标
改造登录页：加载时先调 `POST /device/challenge` 作为唯一探针——`gateEnabled: false` 走现有密码表单（零变化）；`gateEnabled: true` 时自动执行静默过门（IndexedDB 取句柄 → 签名 challenge → `/device/verify` → gate token 存内存），成功后**直接渲染密码表单**，用户感知与今天完全一致。静默过门失败（本机无钥匙/验签 403）时展示「此设备未授权」页面。

未授权页面内嵌**钥匙串生成流程**（用户原始需求）：输入设备名 → 浏览器本地生成（复用 T03 的 `lib/device-key.ts`）→ 展示 base64url 钥匙串供复制，并附引导文案（拿到任一已授权设备的管理页录入，或直接编辑服务器 `storage/trusted-devices.json`）。录入完成后页面提供「重新验证」入口重跑仪式，无需手动刷新。

`X-Gate-Token` 请求头在登录走廊期间由 axios 拦截器附带。

## 上下文
context.md 3.3（gateEnabled 探针语义、X-Gate-Token 头）、3.4（静默过门流程）、3.5（ErrorDeviceGate 403 与安全上下文）。
阅读源码：`pages/login/index.tsx`（现有探针 queryGlobal 流程）、`pages/login/page.tsx`（onPasswordSubmit 主流程，KDF 派生与 challenge 逻辑必须原样保留）、`services/base.ts`（axios 拦截器）、`store/user.ts`、`spike/demo.html`（静默签名参考）。
约束：登录成功后进入应用即丢弃 gate token（内存态，不落 localStorage）；`auth/global` 响应解析、KDF、keyBlob 解包流程一行不改，只在其前面加门禁步骤。

## 边界
允许新增：`pages/login/device-gate.tsx`（门禁/未授权 UI）等登录页新文件；允许修改：`pages/login/index.tsx`、`pages/login/page.tsx`（仅入口编排，不动派生逻辑）、`services/base.ts`（拦截器附加 gate token）、`services/device.ts`（如需补 verify 封装）。可直接复用 T03 的 `lib/device-key.ts`。禁止改动 `lib/e2ee/**`、`store/user.ts` 的 vault 逻辑。

## 验收
门未激活：手动登录流程与现状完全一致（`pnpm -w test:e2e` 中 auth.spec.ts 旧用例全绿）。门激活（手动放一个测试设备进 trusted-devices.json，同浏览器先用管理页绑好本机钥匙）：登录页加载即静默过门、直接显示密码表单、全程零点击，登录成功；清掉 IndexedDB（模拟无钥匙设备/新浏览器）后刷新，显示未授权页面，页面内可完成「输入名字 → 生成钥匙串 → 复制」全流程。

## 依赖
T02（/device/challenge、/device/verify 与 ErrorDeviceGate 语义）、T03（lib/device-key.ts）
