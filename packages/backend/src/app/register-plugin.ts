import { registerSwagger } from "@/lib/swagger";
import { registerFrontendHistory } from "@/lib/frontend-history";
import multipart from "@fastify/multipart";
import { AppInstance } from "@/types";

/**
 * 集成诸如 Swagger 等插件
 */
export const registerPlugin = async (server: AppInstance) => {
  await server.register(multipart, {
    limits: {
      fileSize: 512 * 1024 * 1024,
    },
    attachFieldsToBody: true,
  });

  await registerSwagger(server);

  await registerFrontendHistory(server);

  return server;
};
