import dotenvFlow from "dotenv-flow";

dotenvFlow.config();

const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] ?? defaultValue;
};

export const EnumEnvType = {
  Development: "development",
  Production: "production",
} as const;

/** 是否为生产环境 */
export const ENV_IS_PROD =
  getEnv("NODE_ENV", "development") === EnumEnvType.Production;

/** 是否为开发环境 */
export const ENV_IS_DEV =
  getEnv("NODE_ENV", "development") === EnumEnvType.Development;

/** 后端服务监听的端口 */
export const ENV_BACKEND_PORT = +getEnv("BACKEND_PORT", "3499");

/** 前端部署到的基础路径 */
export const ENV_FRONTEND_BASE_URL = getEnv("FRONTEND_BASE_URL", "/");
