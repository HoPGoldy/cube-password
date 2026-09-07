import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppInstance } from "@/types";
import fastifyStatic from "@fastify/static";
import { PATH_FRONTEND_FILE } from "@/config/path";
import { createErrorResponse } from "../unify-response";
import { ErrorNotFound } from "@/types/error";
import { ENV_FRONTEND_BASE_URL, ENV_IS_PROD, ENV_IS_DEV } from "@/config/env";
import fs from "fs/promises";
import { createHash } from "node:crypto";

/** 预处理后的前端入口产物 */
export interface FrontendIndexArtifact {
  /** 已替换占位符的 index.html 内容 */
  html: string;
  /** 内联脚本的 CSP hash（sha256-'<base64>'） */
  inlineScriptHashes: string[];
}

/**
 * 计算内联脚本的 CSP hash（sha256-'<base64>'）
 * index.html 中的 window.APP_CONFIG 内联配置脚本为 vite 构建产物原样保留，
 * 无法外链化，CSP 通过 hash 放行（hash 随产物内容启动时重新计算，不会失效）
 *
 * 注意：浏览器解析 HTML 时会先把 \r\n / \r 规范化为 \n 再计算 hash，
 * 服务端必须做同样归一化，否则产物含 CRLF 时 hash 不匹配
 */
const inlineScriptHash = (script: string): string => {
  const normalized = script.replace(/\r\n?/g, "\n");
  const hash = createHash("sha256").update(normalized, "utf8").digest("base64");
  return `'sha256-${hash}'`;
};

/**
 * 读取并预处理前端入口文件（仅生产环境有产物；dev 由前端开发服务器托管，返回 null）
 * - 替换 {FRONTEND_BASE_URL} 占位符（不写回磁盘，磁盘原文件保留占位符，每次启动重新替换）
 * - 收集全部内联脚本的 CSP hash，供 register-plugin 的 CSP script-src 使用
 *   （必须在挂载 helmet 之前调用，否则 hash 无法进入 CSP 头）
 */
export const loadFrontendIndex =
  async (): Promise<FrontendIndexArtifact | null> => {
    if (!ENV_IS_PROD) return null;

    const html = (
      await fs.readFile(PATH_FRONTEND_FILE + "/index.html", "utf-8")
    ).replace(/\{FRONTEND_BASE_URL\}/g, ENV_FRONTEND_BASE_URL);

    const inlineScriptHashes = Array.from(
      html.matchAll(/<script>([\s\S]*?)<\/script>/g),
    ).map(([, script]) => inlineScriptHash(script));

    return { html, inlineScriptHashes };
  };

/**
 * 注册前端静态资源和 History 模式路由
 * @param artifact 生产环境下由 loadFrontendIndex() 预处理的入口产物；dev 传 null（本插件不生效）
 */
export const registerFrontendHistory = async (
  server: AppInstance,
  artifact: FrontendIndexArtifact | null,
) => {
  // 开发环境下不启用该功能，由前端开发服务器处理
  if (!artifact) {
    if (ENV_IS_DEV) {
      server.log.warn(
        "frontend-history 未生效：当前为非生产环境（index.html 由前端 dev server 托管）",
      );
    }
    return;
  }

  /** 返回 index.html 内存副本
   * 用 Buffer 发送以绕过 unify-response onSend 对 2xx 字符串 payload 的 JSON 包装
   */
  const sendIndexHtml = (reply: FastifyReply) => {
    reply
      .header("cache-control", "no-cache")
      .type("text/html")
      .send(Buffer.from(artifact.html, "utf-8"));
  };

  // 注册静态文件服务
  // index 设为 false：防止磁盘上带占位符的 index.html 被抢先服务，根路径统一走内存副本
  // wildcard 设为 false：默认的 /* 通配路由会捕获根路径（send 空路径直接 403），
  // 关掉后仅按文件注册具体路由，其余路径全部落入 not-found handler
  await server.register(fastifyStatic, {
    preCompressed: true,
    root: PATH_FRONTEND_FILE,
    prefix: "/",
    index: false,
    wildcard: false,
  });

  // 添加 hook 处理 SPA 路由
  server.setNotFoundHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url.split("?")[0];

      // 只处理 GET / HEAD 请求且不是 API 和静态文件路由
      // （原实现中根路径由 fastifyStatic 接管时也响应 HEAD，保持该行为）
      if (
        (request.method !== "GET" && request.method !== "HEAD") ||
        path.startsWith("/api/") ||
        path.startsWith("/assets/")
      ) {
        reply.code(404).send(createErrorResponse(new ErrorNotFound()));
        return;
      }

      // 检查文件扩展名，有扩展名的请求直接返回 404
      if (path.includes(".")) {
        reply.code(404).send(createErrorResponse(new ErrorNotFound()));
        return;
      }

      // 返回前端入口文件（内存副本）
      sendIndexHtml(reply);
    },
  );
};
