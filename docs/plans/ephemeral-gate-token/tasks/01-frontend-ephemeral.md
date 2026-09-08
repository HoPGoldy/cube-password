# T01: 前端即取即用改造（passGate/corridor/登录流程/拦截器简化）

## 目标

按 context.md 第 2 节 D1-D5 完成 gate token 从页面级缓存到函数局部变量的改造：
删除模块级 token 状态与拦截器自动附带，走廊请求显式传参，登录页 bootstrap 与提交
各自现取现用，拦截器 40301 分支简化为「非门页跳登录 + 门页透传」。

## 上下文

- context.md 全文（尤其第 2 节六条决策与已知的坑第 1/3/4 条）。
- 源码：services/device-gate.ts、services/base.ts、services/auth.ts、
  pages/login/{index,page}.tsx、pages/init/index.tsx、
  pages/login/use-login-success.ts。

## 边界

- 上述文件 + `frontend/src/services/device-gate.test.ts`（编排单测随接口调整）
- 不改后端（T02 的 TTL 除外）；不改 e2e fixtures

## 验收

- grep 确认：gateTokenState/setGateToken/getValidGateToken/GATE_CORRIDOR_URLS/
  clearGateToken 全部零残留；base.ts 无 reload 调用
- 门开时点登录的请求序：device/verify → auth/challenge → auth/login（每轮一组，
  无跨轮 token）
- 停留超时场景：代码路径上不存在（每次现取）；passGate 失败渲染未授权页且不发密码
- pnpm --filter frontend test 全绿（含调整后的编排单测）；tsc/build/lint 过
- e2e：现有用例不回归（门未激活路径 + device-gate 13 条中不涉及提交流程的）

## 依赖

无
