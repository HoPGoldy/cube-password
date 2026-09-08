# T02: 服务端 TTL 收紧与 e2e 补验

## 目标

GateTokenManager TTL 10min → 3min（防御性上限，正常流程秒级用完）；补两条 e2e：
「门开 + 停留后点登录仍成功」（新语义的核心回归钉）与「吊销后点登录渲染未授权页且
密码请求未发出」（吊销即时生效钉）。全量收口。

## 上下文

- context.md 第 2.6 条与第 4 节。
- 源码：backend/src/lib/gate-token/{index,index.test}.ts、packages/e2e/tests/device-gate.spec.ts。

## 边界

- gate-token 的实现与测试（常量与断言）
- e2e device-gate.spec.ts 新增用例（复用现有 fixtures：browserGenerateKeyInitScript、
  TRUSTED_DEVICES 文件操作、gatePage）
- 前端 device-gate.ts 中 TTL 注释同步

## 验收

- TTL 单测断言更新且过；grep 无 10 分钟残留注释
- e2e 新用例：①门开 + 已过门 UI 停留（等待 > 客户端任何缓存概念已不存在，直接模拟
  「不刷新页面点登录」）→ 登录成功；②绑定 → 吊销 → 不刷新点登录 → 未授权页 +
  Network 无 auth/login
- pnpm --filter backend test 全绿；E2E_*_PORT 下 pnpm test:e2e 全量绿

## 依赖

T01（前端新语义就位后 e2e 新用例才有意义）
