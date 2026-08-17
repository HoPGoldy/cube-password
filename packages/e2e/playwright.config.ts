import { defineConfig, devices } from "@playwright/test";
import dotenvFlow from "dotenv-flow";

dotenvFlow.config();

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
      command: "pnpm --filter backend start:dev",
      url: "http://127.0.0.1:3499/api/auth/global",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      cwd: "../backend",
    },
    {
      command: "pnpm --filter frontend start:dev",
      url: "http://localhost:3500",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      cwd: "../frontend",
    },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3500",
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
