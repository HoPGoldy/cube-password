import fastify from "fastify";
import type { AppInstance } from "@/types";
import { logger } from "@/lib/logger";
import { registerService } from "./register-service";
import { registerPlugin } from "./register-plugin";

export const buildApp = async (): Promise<AppInstance> => {
  const server = fastify({
    loggerInstance: logger,
  }) as AppInstance;

  await server.register(registerPlugin);
  await server.register(registerService);

  return server;
};
