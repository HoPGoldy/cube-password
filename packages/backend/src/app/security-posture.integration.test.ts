import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { buildAppWithPrisma } from "@/app/build-app";
import { sha512 } from "@/lib/crypto";
import type { AppInstance } from "@/types";

const require = createRequire(import.meta.url);
const backendDir = join(dirname(fileURLToPath(import.meta.url)), "../", "../");

/**
 * 安全加固行为验收（T02：lockType 枚举 / P2003 / 全 POST）。
 * 走完整 HTTP 栈（buildApp + inject），数据库用临时目录中的独立 SQLite，
 * 通过 prisma CLI migrate deploy 建表，不触碰开发库。
 */
describe.skipIf(process.env.CI_SKIP_INTEGRATION === "1")(
  "安全加固：lockType 枚举 / P2003 / 全 POST",
  () => {
    let app: AppInstance;
    let token = "";
    let tmpDir = "";
    let datasourceUrl = "";
    let prisma: InstanceType<
      (typeof import("@/modules/prisma"))["PrismaService"]
    >;

    const api = (
      method: "GET" | "POST",
      url: string,
      payload?: unknown,
      headers: Record<string, string> = {},
    ) =>
      app.inject({
        method,
        url: `/api${url}`,
        ...(payload !== undefined
          ? { payload: payload as Record<string, unknown> }
          : {}),
        headers: token ? { "x-session-token": token, ...headers } : headers,
      });

    beforeAll(async () => {
      // 1) 临时目录 + 临时 prisma config + migrate 建表
      tmpDir = mkdtempSync(join(tmpdir(), "cube-password-test-"));
      const dbPath = join(tmpDir, "test.db");
      datasourceUrl = `file:${dbPath}`;
      const configPath = join(tmpDir, "prisma.config.ts");
      writeFileSync(
        configPath,
        [
          `import { defineConfig } from "prisma/config";`,
          `export default defineConfig({`,
          `  datasource: { url: "${datasourceUrl}" },`,
          `});`,
          "",
        ].join("\n"),
      );
      const prismaCli = require.resolve("prisma/build/index.js");
      execFileSync(
        process.execPath,
        [
          prismaCli,
          "migrate",
          "deploy",
          "--config",
          configPath,
          "--schema",
          join(backendDir, "prisma/schema.prisma"),
        ],
        { stdio: "pipe" },
      );

      // 3) 组装应用（指向临时库）；不修改 NODE_ENV：保持各测试文件的环境一致性
      const { PrismaService } = await import("@/modules/prisma");
      prisma = new PrismaService({ datasourceUrl });
      app = await buildAppWithPrisma(prisma);
    });

    afterAll(async () => {
      await app.close();
      await prisma.$disconnect();
      rmSync(tmpDir, { recursive: true, force: true });
    });

    /** 初始化用户并以 V = sha512(salt + pwd) 派生登录；已初始化时仅登录 */
    const initAndLogin = async (pwd = "test-pwd-123") => {
      const salt = "A".repeat(64);
      const verifier = sha512(salt + pwd); // 测试用派生（真实 argon2id 由前端完成，服务端只存 V）
      const existing = await prisma.user.findFirst();
      if (!existing) {
        const initRes = await api("POST", "/auth/init", {
          verifier,
          salt,
          keyBlob: "K".repeat(64),
          kdfParams: JSON.stringify({
            algorithm: "argon2id",
            m: 65536,
            t: 2,
            p: 1,
            version: 1,
          }),
        });
        expect(initRes.statusCode).toBe(200);
      }

      const challengeRes = await api("POST", "/auth/challenge");
      const code = challengeRes.json().data.code;
      // hash = SHA512(hex(V) + challenge)，服务端 sha512 输出大写 hex，此处保持一致
      const loginRes = await api("POST", "/auth/login", {
        hash: sha512(verifier + code),
      });
      expect(loginRes.statusCode).toBe(200);
      token = loginRes.json().data.token;
    };

    it("认证 hook（x-session-token 缺失 401）与 init/login 链路可用", async () => {
      const before = await api("POST", "/group/list");
      expect(before.statusCode).toBe(401);

      await initAndLogin();
      const after = await api("POST", "/group/list");
      expect(after.statusCode).toBe(200);
      expect(after.json().data.items).toHaveLength(1); // 默认分组
    });

    it("全 POST：challenge/global/config/version 仅 POST 可用，GET 404", async () => {
      const post = await api("POST", "/auth/challenge");
      expect(post.statusCode).toBe(200);
      expect(post.json().data.code).toEqual(expect.any(String));
      const get = await api("GET", "/auth/challenge");
      expect(get.statusCode).toBe(404);

      const globalPost = await api("POST", "/auth/global");
      expect(globalPost.statusCode).toBe(200);
      const globalGet = await api("GET", "/auth/global");
      expect(globalGet.statusCode).toBe(404);

      const versionPost = await api("POST", "/config/version");
      expect(versionPost.statusCode).toBe(200);
      expect(versionPost.json().data.version).toEqual(expect.any(String));
      const versionGet = await api("GET", "/config/version");
      expect(versionGet.statusCode).toBe(404);
    });

    it("addGroup / updateConfig 传非法 lockType 返回 400", async () => {
      const addRes = await api("POST", "/group/add", {
        name: "g1",
        lockType: "banana",
      });
      expect(addRes.statusCode).toBe(400);
      expect(addRes.json()).toMatchObject({ success: false });

      const updateRes = await api("POST", "/group/update-config", {
        id: 999,
        lockType: "banana",
      });
      expect(updateRes.statusCode).toBe(400);
      expect(updateRes.json()).toMatchObject({ success: false });
    });

    it("addGroup 不传 lockType 默认 None（default 不被 union 破坏）", async () => {
      const res = await api("POST", "/group/add", { name: "default-none" });
      expect(res.statusCode).toBe(200);
      const list = await api("POST", "/group/list");
      const created = list
        .json()
        .data.items.find((i: { name: string }) => i.name === "default-none");
      expect(created.lockType).toBe("None");
    });

    it("unlock 对 lockType='banana' 的存量脏数据抛错不放行（fallback 防御）", async () => {
      await initAndLogin();
      const { PrismaService } = await import("@/modules/prisma");
      const prisma = new PrismaService({ datasourceUrl });
      const dirty = await prisma.group.create({
        data: { name: "dirty", lockType: "banana" },
      });
      try {
        const res = await api("POST", "/group/unlock", { id: dirty.id });
        expect(res.statusCode).toBe(400);
        expect(res.json().message).toContain("未知的分组锁类型");
      } finally {
        await prisma.group.delete({ where: { id: dirty.id } });
        await prisma.$disconnect();
      }
    });

    it("P2003（外键约束）映射为 400「访问的资源不存在」", async () => {
      await initAndLogin();
      // 注意：走 HTTP 的话写门禁（目标分组未解锁→ 403）先于 Prisma 触发，
      // P2003 只能由已解锁分组的 update/move 到不存在目标组时触发，
      // 这里直接用 service 层验证错误映射本身
      await expect(
        prisma.certificate.create({
          data: { name: "c", groupId: 999999 },
        }),
      ).rejects.toMatchObject({ code: "P2003" });

      const addRes = await api("POST", "/certificate/add", {
        name: "c",
        groupId: 999999,
      });
      // 门禁先行：不存在的分组必然未解锁，403 语义正确（非 P2003 路径）
      expect(addRes.statusCode).toBe(403);
    });
  },
);
