import fastify from "fastify";
import type { AppInstance } from "@/types";
import { logger } from "@/lib/logger";
import { PrismaService } from "@/modules/prisma";
import { registerService } from "./register-service";
import { registerPlugin } from "./register-plugin";

/** 默认组装：使用环境配置中的数据库 */
export const buildApp = async (): Promise<AppInstance> => {
  return buildAppWithPrisma(new PrismaService());
};

/** 测试用组装：注入自定义 PrismaService（如临时库） */
export const buildAppWithPrisma = async (
  prisma: PrismaService,
): Promise<AppInstance> => {
  const server = fastify({
    loggerInstance: logger,
  }) as AppInstance;

  await server.register(registerPlugin);
  await server.register(registerService, { prisma });

  return server;
};
