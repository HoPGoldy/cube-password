import { beforeAll, afterAll, describe, expect, it } from "vitest";
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
// 本文件位于 src/modules/certificate/ 下，需三层回退到 backend 包根
const backendDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../",
  "../",
  "../",
);

/**
 * 元数据迁移接口验收（T01：certificate/migrate-metadata）。
 * 走完整 HTTP 栈（buildApp + inject），数据库用临时目录中的独立 SQLite，
 * 通过 prisma CLI migrate deploy 建表，不触碰开发库。
 *
 * 验证点：
 * - 单批上限（>100 拒绝 400）
 * - 事务性（批次中含不存在的 id → 整批回滚，nameEnc 与 metadataVersion 均不落库）
 * - finish=true 收尾同事务写 metadataVersion=2
 * - login 响应下发 metadataVersion
 */
describe.skipIf(process.env.CI_SKIP_INTEGRATION === "1")(
  "元数据迁移：certificate/migrate-metadata",
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
      tmpDir = mkdtempSync(join(tmpdir(), "cube-password-migrate-test-"));
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

      // 2) 组装应用（指向临时库）；不修改 NODE_ENV：保持各测试文件的环境一致性
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
      const loginRes = await api("POST", "/auth/login", {
        hash: sha512(verifier + code),
      });
      expect(loginRes.statusCode).toBe(200);
      token = loginRes.json().data.token;
      return loginRes.json().data;
    };

    /** 在默认分组（无锁，登录自动解锁）创建两个凭证，返回 id */
    const createTwoCertificates = async () => {
      const group = await prisma.group.findFirst();
      const c1 = await api("POST", "/certificate/add", {
        name: "旧明文一",
        groupId: group!.id,
      });
      expect(c1.statusCode).toBe(200);
      const c2 = await api("POST", "/certificate/add", {
        name: "旧明文二",
        groupId: group!.id,
      });
      expect(c2.statusCode).toBe(200);
      return [c1.json().data.id, c2.json().data.id];
    };

    it("login 响应包含 metadataVersion（初始为 1）", async () => {
      const data = await initAndLogin();
      expect(data.metadataVersion).toBe(1);
    });

    it("单批超过 100 条返回 400", async () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        id: i + 1,
        nameEnc: `v2:aes-256-gcm:${i}`,
      }));
      const res = await api("POST", "/certificate/migrate-metadata", { items });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ success: false });
    });

    it("事务性：批次含不存在的 id 时整批不落库（含 finish 的 metadataVersion）", async () => {
      const [id1] = await createTwoCertificates();

      const res = await api("POST", "/certificate/migrate-metadata", {
        items: [
          { id: id1, nameEnc: "v2:aes-256-gcm:should-rollback" },
          { id: 999999, nameEnc: "v2:aes-256-gcm:missing" },
        ],
        finish: true,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ success: false });

      // 整批回滚：id1 的 nameEnc 不落库，metadataVersion 也不收尾
      const cert = await prisma.certificate.findUnique({ where: { id: id1 } });
      expect(cert?.nameEnc).toBe("");
      const user = await prisma.user.findFirst();
      expect(user?.metadataVersion).toBe(1);
    });

    it("写门禁：涉及未解锁分组的凭证返回 403 且不写入", async () => {
      const [id1] = await createTwoCertificates();
      // 新建一个 Password 锁分组（未解锁），把凭证移入后尝试迁移
      const locked = await prisma.group.create({
        data: {
          name: "locked-group",
          lockType: "Password",
          passwordHash: "X".repeat(128),
          passwordSalt: "S".repeat(64),
          kdfParams: JSON.stringify({
            algorithm: "argon2id",
            m: 65536,
            t: 2,
            p: 1,
            version: 1,
          }),
        },
      });
      await prisma.certificate.update({
        where: { id: id1 },
        data: { groupId: locked.id },
      });

      const res = await api("POST", "/certificate/migrate-metadata", {
        items: [{ id: id1, nameEnc: "v2:aes-256-gcm:evil" }],
      });
      expect(res.statusCode).toBe(403);
      const cert = await prisma.certificate.findUnique({ where: { id: id1 } });
      expect(cert?.nameEnc).toBe("");

      await prisma.certificate.delete({ where: { id: id1 } });
      await prisma.group.delete({ where: { id: locked.id } });
    });

    it("finish=true：批量写入 nameEnc 并同事务收尾 metadataVersion=2，login 下发新值", async () => {
      const [id1, id2] = await createTwoCertificates();

      const res = await api("POST", "/certificate/migrate-metadata", {
        items: [
          { id: id1, nameEnc: "v2:aes-256-gcm:enc-one" },
          { id: id2, nameEnc: "v2:aes-256-gcm:enc-two" },
        ],
        finish: true,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({ updated: 2 });

      const cert1 = await prisma.certificate.findUnique({ where: { id: id1 } });
      const cert2 = await prisma.certificate.findUnique({ where: { id: id2 } });
      expect(cert1?.nameEnc).toBe("v2:aes-256-gcm:enc-one");
      expect(cert2?.nameEnc).toBe("v2:aes-256-gcm:enc-two");
      const user = await prisma.user.findFirst();
      expect(user?.metadataVersion).toBe(2);

      // 重新登录：响应中的 metadataVersion 应为收尾后的 2
      const data = await initAndLogin();
      expect(data.metadataVersion).toBe(2);
    });

    it("list/detail 返回 nameEnc（迁移期 name 兼容保留）", async () => {
      const [id1] = await createTwoCertificates();
      const group = await prisma.group.findFirst();

      const list = await api("POST", "/certificate/list", {
        groupId: group!.id,
      });
      expect(list.statusCode).toBe(200);
      const item = list
        .json()
        .data.items.find((i: { id: number }) => i.id === id1);
      expect(item.name).toBe("旧明文一"); // 旧列只读保留
      expect(item.nameEnc).toBe("");

      const detail = await api("POST", "/certificate/detail", { id: id1 });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data.nameEnc).toBe("");
    });

    it("certificate/index：返回可达分组全量索引字段（不含 name/content）", async () => {
      const [id1] = await createTwoCertificates();
      const group = await prisma.group.findFirst();

      const res = await api("POST", "/certificate/index", {});
      expect(res.statusCode).toBe(200);
      const items = res.json().data.items;
      const found = items.find((i: { id: number }) => i.id === id1);
      expect(found).toBeDefined();
      expect(found.groupId).toBe(group!.id);
      // 索引字段齐全
      expect(typeof found.nameEnc).toBe("string");
      expect(typeof found.updatedAt).toBe("string");
      // 不泄露名称与内容
      expect(found.name).toBeUndefined();
      expect(found.content).toBeUndefined();
    });

    it("certificate/index：锁定分组的凭证不出现在索引中", async () => {
      const [id1] = await createTwoCertificates();
      const locked = await prisma.group.create({
        data: {
          name: "index-locked-group",
          lockType: "Password",
          passwordHash: "X".repeat(128),
          passwordSalt: "S".repeat(64),
          kdfParams: JSON.stringify({
            algorithm: "argon2id",
            m: 65536,
            t: 2,
            p: 1,
            version: 1,
          }),
        },
      });
      await prisma.certificate.update({
        where: { id: id1 },
        data: { groupId: locked.id },
      });

      const res = await api("POST", "/certificate/index", {});
      expect(res.statusCode).toBe(200);
      const items = res.json().data.items;
      expect(items.find((i: { id: number }) => i.id === id1)).toBeUndefined();

      await prisma.certificate.delete({ where: { id: id1 } });
      await prisma.group.delete({ where: { id: locked.id } });
    });
  },
);
