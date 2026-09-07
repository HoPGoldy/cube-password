import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";

/**
 * device 模块 + 门禁 preHandler 的完整 HTTP 栈验收（走 buildApp + inject）。
 *
 * 注意：真实后端进程从 packages/backend/storage 读写 trusted-devices.json；
 * 本测试通过 vi.mock 把 PATH_ROOT 指向临时目录，既不触碰真实存储，
 * 也顺便验证 isGateEnabled 在 preHandler 中按请求实时求值（门随文件即时开关）。
 * vi.mock 工厂会被提升，路径字面量必须内联；其余路径导出保持真实值。
 */
const TEST_DIR = "/tmp/cube-password-test/device-gate-integration";

vi.mock("@/config/path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/path")>();
  return {
    ...actual,
    PATH_ROOT: "/tmp/cube-password-test/device-gate-integration",
  };
});

import { buildAppWithPrisma } from "@/app/build-app";
import { PrismaService } from "@/modules/prisma";
import { NotificationService } from "@/modules/notification/service";
import { sha512 } from "@/lib/crypto";
import { PATH_TRUSTED_DEVICES } from "@/lib/device-store";
import { serializeDeviceKey } from "@/lib/device-key";
import { NoticeType } from "@/types/notification";
import type { AppInstance } from "@/types";

const require = createRequire(import.meta.url);
const backendDir = join(dirname(fileURLToPath(import.meta.url)), "../", "../");

/** 按 WebCrypto 语义签名：hash 先行 + raw r||s 输出，等价浏览器 crypto.subtle.sign */
const webCryptoStyleSign = (privateKey: unknown, data: string): string => {
  return nodeSign("sha256", Buffer.from(data, "utf8"), {
    // @ts-expect-error 测试辅助的宽松入参
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64");
};

describe.skipIf(process.env.CI_SKIP_INTEGRATION === "1")(
  "device 模块接口 + 门禁 preHandler",
  () => {
    let app: AppInstance;
    let prisma: PrismaService;
    let token = "";
    let tmpDir = "";
    /** createNotice 间谍：捕获敲门通知（避免刺探 Prisma 7 模型代理属性） */
    let createNoticeSpy: MockInstance<
      typeof NotificationService.prototype.createNotice
    >;

    const api = (
      url: string,
      payload: unknown = {},
      headers: Record<string, string> = {},
    ) =>
      app.inject({
        method: "POST",
        url: `/api${url}`,
        payload: payload as Record<string, unknown>,
        headers,
      });

    /** 用本测试生成的 P-256 钥匙走一遍真实的过门流程，返回 gate token */
    const knockThrough = async (
      deviceId: string,
      privateKey: unknown,
    ): Promise<string> => {
      const challengeRes = await api("/device/challenge");
      expect(challengeRes.statusCode).toBe(200);
      const { challenge } = challengeRes.json().data;

      const verifyRes = await api("/device/verify", {
        deviceId,
        challenge,
        signature: webCryptoStyleSign(privateKey, challenge),
      });
      expect(verifyRes.statusCode).toBe(200);
      return verifyRes.json().data.gateToken;
    };

    beforeAll(async () => {
      mkdirSync(TEST_DIR, { recursive: true });

      // 临时 prisma config + migrate 建表（不触碰开发库）
      tmpDir = TEST_DIR;
      const dbPath = join(tmpDir, "test.db");
      const datasourceUrl = `file:${dbPath}`;
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
        "utf8",
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

      prisma = new PrismaService({ datasourceUrl });
      app = await buildAppWithPrisma(prisma);

      // 通知落库改为内存捕获（不打真实库）
      createNoticeSpy = vi
        .spyOn(NotificationService.prototype, "createNotice")
        .mockResolvedValue(undefined);

      // 初始化用户（登录链路需要）
      const salt = "A".repeat(64);
      const verifier = sha512(salt + "test-pwd-123");
      await prisma.user.create({
        data: {
          passwordHash: verifier,
          passwordSalt: salt,
          keyBlob: "K".repeat(64),
          kdfParams: JSON.stringify({
            algorithm: "argon2id",
            m: 65536,
            t: 2,
            p: 1,
            version: 1,
          }),
        },
      });
    });

    afterAll(async () => {
      createNoticeSpy?.mockRestore();
      await app.close();
      await prisma.$disconnect();
      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it("门未激活：auth/global 照常 200，/device/challenge 探针回报 gateEnabled=false", async () => {
      const globalRes = await api("/auth/global");
      expect(globalRes.statusCode).toBe(200);

      const probe = await api("/device/challenge");
      expect(probe.statusCode).toBe(200);
      expect(probe.json().data).toMatchObject({ gateEnabled: false });
      expect(probe.json().data.challenge).toEqual(expect.any(String));
    });

    it("门激活：无 gate token 访问 auth/global|challenge|login 全部 403 ErrorDeviceGate", async () => {
      const { publicKey, privateKey } = generateKeyPairSync("ec", {
        namedCurve: "P-256",
      });
      const spki = publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64");
      writeFileSync(
        PATH_TRUSTED_DEVICES,
        JSON.stringify({
          devices: [
            {
              id: "dev-1",
              name: "TestDevice",
              publicKey: spki,
              createdAt: "2026-02-10T08:00:00.000Z",
              lastSeenAt: "2026-02-10T08:00:00.000Z",
            },
          ],
        }),
        "utf8",
      );
      // 保存私钥供后续用例过门
      testPrivateKey = privateKey;

      for (const [url, body] of [
        ["/auth/global", {}],
        ["/auth/challenge", {}],
        ["/auth/login", { hash: "x" }],
        // init 是四条预登录路由中最敏感的（账户抢占入口），必须钉住门禁断言
        [
          "/auth/init",
          {
            verifier: "v",
            salt: "s",
            keyBlob: "k",
            kdfParams: "{}",
          },
        ],
      ] as const) {
        const res = await api(url, body);
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ success: false, code: 40301 });
      }
    });

    /** 由上一个用例写入的私钥（dev-1） */
    let testPrivateKey: unknown;

    it("/device/challenge 与 /device/verify 豁免门禁；伪造签名 403 且落一条 Warning 通知", async () => {
      // 豁免路由无需 gate token 可达
      const probe = await api("/device/challenge");
      expect(probe.statusCode).toBe(200);
      expect(probe.json().data.gateEnabled).toBe(true);

      // 陌生设备：签名错误 → 403
      const badRes = await api("/device/verify", {
        deviceId: "dev-1",
        challenge: probe.json().data.challenge,
        signature: "broken-signature",
      });
      expect(badRes.statusCode).toBe(403);
      expect(badRes.json().code).toBe(40301);

      // 敲门失败落一条 Warning 通知
      expect(createNoticeSpy).toHaveBeenCalledTimes(1);
      expect(createNoticeSpy.mock.calls[0][2]).toBe(NoticeType.Warning);
      expect(createNoticeSpy.mock.calls[0][1]).toContain("127.0.0.1");
    });

    it("真实 P-256 钥匙过门：verify 签发 gate token，携带它访问 auth 路由恢复 200", async () => {
      const gateToken = await knockThrough("dev-1", testPrivateKey);

      const globalRes = await api(
        "/auth/global",
        {},
        { "x-gate-token": gateToken },
      );
      expect(globalRes.statusCode).toBe(200);
      expect(globalRes.json().data.isInitialized).toBe(true);

      const challengeRes = await api(
        "/auth/challenge",
        {},
        { "x-gate-token": gateToken },
      );
      expect(challengeRes.statusCode).toBe(200);

      const loginRes = await api(
        "/auth/login",
        { hash: sha512("wrong") },
        { "x-gate-token": gateToken },
      );
      // 有效 token 过门禁后进入业务逻辑：挑战码未申请 → 401（而非门禁 403）
      expect(loginRes.statusCode).toBe(401);
      expect(loginRes.json().code).not.toBe(40301);
    });

    it("伪造 gate token 被拒绝", async () => {
      const res = await api("/auth/global", {}, { "x-gate-token": "forged" });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(40301);
    });

    it("手工清空文件即门失效：所有路由恢复放行（无需重启）", async () => {
      writeFileSync(PATH_TRUSTED_DEVICES, '{"devices":[]}', "utf8");

      const globalRes = await api("/auth/global");
      expect(globalRes.statusCode).toBe(200);
      const probe = await api("/device/challenge");
      expect(probe.json().data.gateEnabled).toBe(false);
    });

    it("session 保护：/device/add|list|revoke 无 token 401", async () => {
      for (const [url, payload] of [
        ["/device/add", { deviceKey: "cube-device-key:v1:xxx" }],
        ["/device/list", {}],
        ["/device/revoke", { id: "whatever" }],
      ] as const) {
        const res = await api(url, payload);
        expect(res.statusCode).toBe(401);
        expect(res.json().code).toBe(40102);
      }
    });

    it("add → list → revoke 全链路（session 保护下）；重复公钥 400", async () => {
      // 登录拿 session token
      const challengeRes = await api("/auth/challenge");
      const code = challengeRes.json().data.code;
      const salt = "A".repeat(64);
      const verifier = sha512(salt + "test-pwd-123");
      const loginRes = await api("/auth/login", {
        hash: sha512(verifier + code),
      });
      expect(loginRes.statusCode).toBe(200);
      token = loginRes.json().data.token;

      const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
      const spki = publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64");
      const deviceKey = serializeDeviceKey({
        name: "MacBook",
        publicKey: spki,
      });

      // add（带 session）
      const addRes = await api(
        "/device/add",
        { deviceKey },
        { "x-session-token": token },
      );
      expect(addRes.statusCode).toBe(200);
      const addedId = addRes.json().data.id;
      expect(addedId).toEqual(expect.any(String));

      // 重复公钥 400
      const dupRes = await api(
        "/device/add",
        {
          deviceKey: serializeDeviceKey({ name: "Other", publicKey: spki }),
        },
        { "x-session-token": token },
      );
      expect(dupRes.statusCode).toBe(400);

      // 非法钥匙串 400
      const badKeyRes = await api(
        "/device/add",
        { deviceKey: "not-a-device-key" },
        { "x-session-token": token },
      );
      expect(badKeyRes.statusCode).toBe(400);

      // list
      const listRes = await api(
        "/device/list",
        {},
        { "x-session-token": token },
      );
      expect(listRes.statusCode).toBe(200);
      const item = listRes
        .json()
        .data.items.find((i: { id: string }) => i.id === addedId);
      expect(item).toMatchObject({ name: "MacBook", publicKey: spki });
      expect(item.lastSeenAt).toEqual(expect.any(String));

      // revoke
      const revokeRes = await api(
        "/device/revoke",
        { id: addedId },
        { "x-session-token": token },
      );
      expect(revokeRes.statusCode).toBe(200);
      const listAfter = await api(
        "/device/list",
        {},
        { "x-session-token": token },
      );
      expect(
        listAfter
          .json()
          .data.items.find((i: { id: string }) => i.id === addedId),
      ).toBeUndefined();
    });
  },
);
