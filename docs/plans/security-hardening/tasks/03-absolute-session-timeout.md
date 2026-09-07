# T03: 10 分钟绝对会话超时 + 前端倒计时

## 目标

把 session 从"30 分钟滑动续期"（活跃即可无限续命）改为"距创建 10 分钟绝对过期"，
前端右上角常驻倒计时，到期弹回登录页。为什么：滑动超时让被劫持的 session 可以靠
持续操作永生，是这轮根源修复的核心项；10 分钟强制重登同时压缩 DEK 在内存中的存活
窗口。用户已确认：不做编辑现场保护、服务重启丢 session 接受。

## 上下文

- context.md 第 2.1 条与"已知的坑"第 3、5 条。
- 必读源码：`backend/src/lib/session/index.ts`（现有滑动续期逻辑 + getCurrentSession
  与 getSession 的重复超时代码，重构时顺手去重）、`frontend/src/store/user.ts`
  （login() 是倒计时起点的落点）、`frontend/src/layouts/app-container/index.tsx`
  （右上角挂载点，用 @hopgoldy/cube-ui 的 CubeApp header）、
  `frontend/src/services/base.ts`（401 拦截器已有 logout 逻辑，确认到期弹回行为）。

## 边界

- `backend/src/lib/session/index.ts` + 对应测试
- `backend/src/modules/auth/service.ts`（login 返回值如需带过期时刻则改）
- `frontend/src/store/user.ts`、`frontend/src/layouts/app-container/**`
- 可新增 `frontend/src/hooks/use-session-countdown.ts`（或等价位置）

## 验收

- 后端单测：session 创建后即使持续调用 getSession（活跃），超过 10 分钟仍判定过期。
- 临时把超时调成秒级跑 e2e 或手动验证：倒计时归零后下一次请求 401 → 弹回登录页。
- 正常 10 分钟参数下 `pnpm test:e2e` 全绿（e2e 单用例时长远小于 10 分钟，不受影响）。
- 倒计时组件：mm:ss 格式、最后 1 分钟变警示色（实现自由裁量）、移动端布局不破。

## 依赖

无（与 T01/T02 并行安全；T04 的 e2e 收口覆盖本任务）。
