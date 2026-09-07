import { defineConfig, devices } from "@playwright/test";
import dotenvFlow from "dotenv-flow";

dotenvFlow.config();

/**
 * 后端/前端端口：与 backend/.env 的 BACKEND_PORT、frontend start:dev 一致；
 * 本机多项目并行开发（其他项目占用默认端口）时可用环境变量旁路，不改变默认值
 */
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "3499";
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "3500";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  webServer: [
    {
      // 将端口注入子进程（playwright 会透传本进程 env，这里显式展开保证默认值也生效）
      command: `BACKEND_PORT=${BACKEND_PORT} pnpm --filter backend start:dev`,
      // 全 POST 化后 dev 后端无任何 GET API 路由，探活改用 /docs（swagger-ui，
      // 仅开发环境注册，与 e2e 所用 start:dev 一致；GET 200 可被 playwright 探活识别）
      url: `http://127.0.0.1:${BACKEND_PORT}/docs`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      cwd: "../backend",
    },
    {
      command: `FRONTEND_PORT=${FRONTEND_PORT} BACKEND_PORT=${BACKEND_PORT} pnpm --filter frontend start:dev`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      cwd: "../frontend",
    },
  ],
  use: {
    // E2E_FRONTEND_PORT 显式设置时优先于 E2E_BASE_URL（.env 中的默认值），
    // 保证端口旁路时浏览器与 request 都指向旁路实例
    baseURL: process.env.E2E_FRONTEND_PORT
      ? `http://localhost:${FRONTEND_PORT}`
      : process.env.E2E_BASE_URL || `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
