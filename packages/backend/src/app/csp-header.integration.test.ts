import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

import { buildAppWithPrisma } from "@/app/build-app";
import type { AppInstance } from "@/types";

const require = createRequire(import.meta.url);
const backendDir = join(dirname(fileURLToPath(import.meta.url)), "../", "../");

/**
 * CSP 安全响应头验收（T05）：
 * 走完整 HTTP 栈（buildAppWithPrisma + inject），验证 helmet 挂载后
 * API 路由的 CSP 与安全头。dev/prod 差异由 NODE_ENV 决定（CI 默认 dev 断言；
 * NODE_ENV=production 运行时走 prod 断言分支）。
 */
describe.skipIf(process.env.CI_SKIP_INTEGRATION === "1")(
  "CSP 安全响应头（T05）",
  () => {
    let app: AppInstance;
    let tmpDir = "";

    const getCsp = async () => {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/global",
      });
      return r.headers["content-security-policy"] ?? "";
    };

    beforeAll(async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "cube-password-csp-test-"));
      const dbPath = join(tmpDir, "test.db");
      const configPath = join(tmpDir, "prisma.config.ts");
      writeFileSync(
        configPath,
        [
          `import { defineConfig } from "prisma/config";`,
          `export default defineConfig({`,
          `  datasource: { url: "file:${dbPath}" },`,
          `});`,
        ].join("\n"),
      );
      const prismaCli = require.resolve("prisma/build/index.js");
      execFileSync(prismaCli, ["migrate", "deploy", "--config", configPath], {
        cwd: backendDir,
        stdio: "pipe",
      });

      const { PrismaService } = await import("@/modules/prisma");
      const prisma = new PrismaService({ datasourceUrl: `file:${dbPath}` });

      // NODE_ENV=production 模拟时 frontend-history 会读取前端产物入口，
      // 测试环境无真实产物，补一个最小 index.html（目录由 ensurePathExists 已创建）
      if (process.env.NODE_ENV === "production") {
        const { PATH_FRONTEND_FILE } = await import("@/config/path");
        if (!existsSync(PATH_FRONTEND_FILE + "/index.html")) {
          writeFileSync(
            PATH_FRONTEND_FILE + "/index.html",
            "<!DOCTYPE html><html><body>probe</body></html>",
          );
        }
      }

      app = await buildAppWithPrisma(prisma);
    });

    afterAll(async () => {
      await app?.close();
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("业务路由带 CSP 且核心指令正确", async () => {
      const csp = await getCsp();
      expect(csp).not.toBe("");
      expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("connect-src 'self'");
    });

    it("其他 helmet 默认安全头存在", async () => {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/global",
      });
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(r.headers["referrer-policy"]).toBe("no-referrer");
      expect(r.headers["cross-origin-opener-policy"]).toBe("same-origin");
    });

    it("环境差异：dev 放宽 HMR / prod 严格", async () => {
      const csp = await getCsp();
      const isProd = process.env.NODE_ENV === "production";
      // upgrade-insecure-requests 全环境移除（README 默认 http 直连部署，
      // 该头会改写 http 请求为 https 导致无 TLS 端口必挂；https 部署由 nginx HSTS 承担）
      expect(csp).not.toContain("upgrade-insecure-requests");
      if (isProd) {
        // 生产：严格，无任何 localhost 放宽
        expect(csp).not.toContain("localhost");
      } else {
        // 开发：放行 vite HMR（websocket 与 /@vite/ 客户端脚本）
        expect(csp).toContain("ws://localhost:*");
      }
    });
  },
);
