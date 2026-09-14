# T02: 前端设备管理页开关化

## 目标

设备管理页按 context D4 改造：OFF 只显示开关；ON 首次展示绑定引导（生成钥匙串 →
保存并启用两步调用）；已启用展示完整管理内容；关闭 confirm；吊销最后一台的警告文案。

## 上下文

- context.md 第 2 节 D4 与已知的坑第 5 条
- 源码：pages/device-manage/content.tsx、services/device.ts（新增 gate-config 两个
  hook）、components 中现成的钥匙串生成卡片逻辑（复用）

## 边界

- pages/device-manage/**、services/device.ts
- 复用现有 KeyGenCard/设备列表组件，不重写

## 验收

- 空库：登录 → 设备管理 → 仅开关（OFF），无其他内容
- 打开开关（空库）：展示引导卡，[保存并启用] 在钥匙串未生成时置灰；生成后可点击，
  成功后门激活、列表出现本机设备
- 已启用：开关 ON + 完整内容（列表/录入/吊销）——与现有功能一致地可用
- 关闭：confirm 文案含「关闭后任何知道地址的设备都能尝试登录」；确认后开关 OFF、
  设备清单保留（再次开启时直接可用，无需重新绑定）
- 吊销最后一台：confirm 追加「门开启状态下移除后将无人能通过设备验证…」警告
- pnpm --filter frontend test/tsc/build/lint 过；手动 dev 冒烟（主 agent 执行）：
  开关全生命周期无 console 错误

## 依赖

T01（gate-config 接口）
