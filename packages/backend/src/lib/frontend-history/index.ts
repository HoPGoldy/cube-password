import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { PATH_FRONTEND_FILE } from "@/config/path";
import { createErrorResponse } from "../unify-response";
import { ErrorNotFound } from "@/types/error";
import { ENV_FRONTEND_BASE_URL, ENV_IS_PROD } from "@/config/env";
import fs from "fs/promises";

/**
 * 注册前端静态资源和 History 模式路由
 */
export const registerFrontendHistory = async (server: FastifyInstance) => {
  // 开发环境下不启用该功能，由前端开发服务器处理
  if (!ENV_IS_PROD) return;

  /**
   * index.html 的内存副本：启动时读取并替换占位符，不写回磁盘
   * （磁盘上的原文件保留 {FRONTEND_BASE_URL} 占位符，每次启动重新替换）
   */
  const initialIndexHtml = await fs.readFile(
    PATH_FRONTEND_FILE + "/index.html",
    "utf-8",
  );

  const replacedIndexHtml = initialIndexHtml.replace(
    /\{FRONTEND_BASE_URL\}/g,
    ENV_FRONTEND_BASE_URL,
  );

  /**
   * 返回 index.html 内存副本
   * 用 Buffer 发送以绕过 unify-response onSend 对 2xx 字符串 payload 的 JSON 包装
   */
  const sendIndexHtml = (reply: FastifyReply) => {
    reply
      .header("cache-control", "no-cache")
      .type("text/html")
      .send(Buffer.from(replacedIndexHtml, "utf-8"));
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
