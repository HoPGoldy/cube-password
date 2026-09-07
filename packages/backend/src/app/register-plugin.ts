import fastifyPlugin from "fastify-plugin";
import { registerSwagger } from "@/lib/swagger";
import {
  registerFrontendHistory,
  loadFrontendIndex,
} from "@/lib/frontend-history";
import fastifyHelmet from "@fastify/helmet";
import { ENV_IS_PROD } from "@/config/env";
import { AppInstance } from "@/types";

/**
 * CSP 指令（在 helmet 默认指令基础上覆盖/追加）
 * - script-src 的 wasm-unsafe-eval：hash-wasm 实例化 wasm 模块必须
 * - style-src 的 unsafe-inline：antd 运行时样式注入必须
 * - frame-ancestors/object-src/base-uri：按安全加固要求显式收紧
 */
const cspDirectives = {
  "script-src": ["'self'", "'wasm-unsafe-eval'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["'self'"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
} as const;

/**
 * 集成诸如 Helmet、Swagger 等插件
 *
 * 必须用 fastify-plugin 包装：否则本函数被 server.register() 调用时会创建独立的
 * 封装上下文，@fastify/helmet 的 onRequest hook 将无法作用于兄弟插件
 * （registerService 注册的 /api 业务路由），安全头会静默丢失
 */
export const registerPlugin = fastifyPlugin(async (server: AppInstance) => {
  // 先加载前端入口产物：生产下 index.html 存在内联的 window.APP_CONFIG 配置脚本，
  // 其 CSP hash 必须先于 helmet 挂载计算出来，合入 script-src 放行
  const frontendIndex = await loadFrontendIndex();

  const scriptSrc = ENV_IS_PROD
    ? [
        ...cspDirectives["script-src"],
        ...(frontendIndex?.inlineScriptHashes ?? []),
      ]
    : // 非生产：放行 vite dev server 的 HMR 客户端脚本（文档由 vite 托管，此为兜底）
      [...cspDirectives["script-src"], "localhost:*", "127.0.0.1:*"];

  const connectSrc = ENV_IS_PROD
    ? cspDirectives["connect-src"]
    : // 非生产：放行 vite HMR 的 websocket 连接
      [...cspDirectives["connect-src"], "ws://localhost:*", "ws://127.0.0.1:*"];

  await server.register(fastifyHelmet, {
    // HSTS 不在应用层下发：helmet 8 的 HSTS 中间件无条件设头（不看协议，
    // 与 UIR 不同，不能靠 http 直连被浏览器忽略而豁免），且默认
    // includeSubDomains 会隐蔽波及同域其他 http 子域。协议升级职责完全
    // 交给部署者的 nginx（https 部署时 add_header HSTS，见 README）
    strictTransportSecurity: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...cspDirectives,
        "script-src": scriptSrc,
        "connect-src": connectSrc,
        // upgrade-insecure-requests 全环境移除：README 默认部署方式是
        // http 直连（docker -p 3499 / nginx proxy_pass http://...），该头会把
        // 页面内所有 http 请求改写为 https → 无 TLS 端口必挂
        "upgrade-insecure-requests": null,
      },
    },
  });

  await server.register(registerSwagger);

  // registerPlugin 已 fastify-plugin 包装，直接调用即可在根上下文注册，
  // 保证 setNotFoundHandler（SPA fallback）能覆盖所有路由的 404
  await registerFrontendHistory(server, frontendIndex);
});
