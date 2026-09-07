# T05: CSP 上线

## 目标

为服务挂上严格 CSP 与 Helmet 安全响应头，堵住"注入外联脚本/数据外传"这条最主要的
XSS 利用路径。放在批次最后做：先本地全功能验证再跑 e2e，避免 CSP 违规干扰前序改动
的排查。

## 上下文

- context.md 第 2.2 条与"已知的坑"第 1、6 条。
- 必读源码：`backend/src/app/register-plugin.ts`（挂载点）、
  `backend/src/lib/frontend-history/index.ts`（onSend Buffer 绕过行为，勿动）、
  `packages/frontend/vite.config.ts` 与 `frontend/plugins/vite-base-plugin.ts`
  （确认构建产物无内联 script 依赖）。

## 边界

- `backend/package.json`（新增 @fastify/helmet）
- `backend/src/app/register-plugin.ts`
- 仅当构建产物存在内联 script 时才允许动 `frontend/index.html`/vite 插件，且需在
  PR 说明中记录原因。

## 验收

- 响应头包含：`Content-Security-Policy`（script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none';
  object-src 'none'; base-uri 'self'）、X-Content-Type-Options、X-Frame-Options 等
  Helmet 默认头。
- 手动全功能过一遍：登录（含 argon2id 派生）、凭证增删改查、搜索、分组解锁、改密码、
  TOTP 页、主题切换——DevTools Console 零 CSP 违规报错。
- `pnpm test:e2e` 全绿；`pnpm --filter backend build && pnpm --filter frontend build` 通过。

## 依赖

T01-T04 全部完成（CSP 最后上，见 context.md 交付顺序）。
