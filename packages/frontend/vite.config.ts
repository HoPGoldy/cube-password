import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteCompression from "vite-plugin-compression";
import tsconfigPaths from "vite-tsconfig-paths";
import { viteAddBasePlugin } from "./plugins/vite-base-plugin";

export default defineConfig({
  base: "./",
  plugins: [tsconfigPaths(), react(), viteAddBasePlugin(), viteCompression()],
  build: {
    reportCompressedSize: false,
  },
  server: {
    proxy: {
      "/api/": {
        // 与 backend/.env 的 BACKEND_PORT 一致，端口被占时可用环境变量旁路
        target: `http://localhost:${process.env.BACKEND_PORT ?? 3499}/`,
        changeOrigin: true,
      },
    },
  },
});
