# T04: index.html 注入改内存副本

## 目标
`registerFrontendHistory` 的生产路径改为：启动时读 `index.html` → 替换 `{FRONTEND_BASE_URL}` → **存入模块级变量，不写回磁盘**；所有原本会返回 index.html 的请求（根路径 + SPA fallback）统一返回内存副本。实现细节（context.md 第 2 节第 4 条，均为主访谈拍板）：① `fastifyStatic` 配置 `index: false`，防磁盘上带占位符的文件被抢先服务；② 返回用 `reply.type("text/html").send(Buffer.from(html))`——Buffer 绕过 `unify-response` onSend 对 2xx 字符串的 JSON 包装；③ 响应头加 `Cache-Control: no-cache`。开发环境 early-return 保持不变。

## 上下文
context.md 第 2 节第 4 条、第 3 节「已知的坑」；源码：`packages/backend/src/lib/frontend-history/index.ts`、`lib/unify-response/index.ts`（只读，理解包装行为）、`packages/frontend/index.html` 与 `packages/frontend/.env.production`（只读，理解占位符来源）。

## 边界
- 允许修改：`lib/frontend-history/index.ts`。
- 禁止触碰：`unify-response`、`config/path.ts`、前端构建产物链。

## 实施备注（执行中确认的必要修正）
- `fastifyStatic` 还需同时设 `wildcard: false`：v8 默认的 `/*` 通配路由会捕获根路径（send 空路径 → 403），导致根路径永远到不了 not-found handler，内存副本方案无法达成。已验证并回写本文件。

## 验收
- `pnpm --filter backend exec tsc --noEmit` 零错误。
- 生产冒烟（在仓库根目录）：`NODE_ENV=production BACKEND_PORT=3498 node packages/backend/dist/index.js`（先 `pnpm --filter backend build` 与 `pnpm --filter frontend build`；若 prisma migrate deploy 缺失按 entrypoint.sh 提示补齐或直接以 dev 库运行），然后 `curl -si http://127.0.0.1:3498/ | head -30`：状态 200、`content-type: text/html`、含 `cache-control: no-cache`、body 的 `window.APP_CONFIG` 含替换后的 basename（非 `{FRONTEND_BASE_URL}`）；连续 curl 两次 body 一致；`curl -si http://127.0.0.1:3498/login` 同样返回 HTML。冒烟后杀掉进程。
- `packages/frontend/dist/index.html` 磁盘文件内容不被修改（md5sum 前后一致）。

## 依赖
无
