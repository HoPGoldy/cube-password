import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import viteCompression from "vite-plugin-compression";
import tsconfigPaths from "vite-tsconfig-paths";
import { viteAddBasePlugin } from "./plugins/vite-base-plugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort = process.env.BACKEND_PORT || env.BACKEND_PORT || "3499";
  const frontendPort = Number(
    process.env.FRONTEND_PORT || env.FRONTEND_PORT || "3500",
  );

  return {
    base: "./",
    plugins: [tsconfigPaths(), react(), viteAddBasePlugin(), viteCompression()],
    build: {
      reportCompressedSize: false,
    },
    server: {
      port: frontendPort,
      proxy: {
        "/api/": {
          // 与 backend/.env 的 BACKEND_PORT 一致，端口被占时可用环境变量旁路
          target: `http://localhost:${backendPort}/`,
          changeOrigin: true,
        },
      },
    },
  };
});
