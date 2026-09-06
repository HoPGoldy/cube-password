import { registerSwagger } from "@/lib/swagger";
import { registerFrontendHistory } from "@/lib/frontend-history";
import { AppInstance } from "@/types";

/**
 * 集成诸如 Swagger 等插件
 */
export const registerPlugin = async (server: AppInstance) => {
  await server.register(registerSwagger);

  await server.register(registerFrontendHistory);
};
