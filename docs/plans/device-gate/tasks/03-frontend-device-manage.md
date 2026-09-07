# T03: 前端：钥匙生成/录入与管理页

## 目标
前端新增 `lib/device-key.ts`（浏览器本地密钥生成 + IndexedDB 句柄存取 + 钥匙串导出 + 静默签名）与 `services/device.ts`（5 个接口的 react-query 封装），并在账号菜单新增「设备管理」Modal（复用 `SettingContainer` + searchParams 模式）：本机一键生成绑定、粘贴钥匙串录入、设备列表（名称/绑定时间/最后活跃）、吊销按钮。给用户提供 ssh authorized_keys 式的管理体验。

## 上下文
context.md 3.3（接口契约）、3.4（密钥参数与 IndexedDB 约定）、3.1（spike 参考实现）。
阅读源码：`spike/demo.html`（生成/签名/存储三步的完整可跑代码）、`pages/security-log/index.tsx`（Modal+searchParams 模式）、`layouts/app-container/index.tsx`（accountMenuItems 注册点，L74-107）、`services/auth.ts` / `services/base.ts`、`utils/message.ts`。
密钥参数：`generateKey(ECDSA P-256, extractable: false, ['sign'])`，签名 `{ name: 'ECDSA', hash: 'SHA-256' }`；私钥句柄经 structured clone 存 IndexedDB（材料永不出浏览器密钥库）。
注意：本任务只需保证管理页在已登录状态下可用；「此设备未授权」页面与静默过门流程属 T04。

## 边界
允许新增：`packages/frontend/src/lib/device-key.ts`、`services/device.ts`、`pages/device-manage/`；允许修改：`layouts/app-container/index.tsx`（菜单项）。禁止改动登录页与 E2EE 相关文件，禁止新增 npm 依赖。

## 验收
`pnpm -w lint` 通过；dev 环境手动验证：门未激活时登录 → 账号菜单出现「设备管理」→「本机生成并绑定」零弹窗完成 → 列表出现该设备 → `storage/trusted-devices.json` 内容正确；粘贴格式非法的钥匙串报友好错误；吊销后文件同步删除；DevTools → IndexedDB 可见私钥句柄条目。

## 依赖
T02（/device/add、/device/list、/device/revoke 接口）
