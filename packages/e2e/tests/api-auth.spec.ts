import {
  test,
  expect,
  authHeaders,
  BASE,
  sha512,
  deriveMasterKey,
  bytesToHex,
  getLoginFailureCount,
} from "../fixtures/api";
import { test as rawTest } from "@playwright/test";
import {
  hexToBytes,
  parseKdfParams,
  DEFAULT_KDF_PARAMS,
} from "@frontend/lib/e2ee";

const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

rawTest.describe("Auth API - 公开接口", () => {
  rawTest("GET /api/auth/challenge 获取挑战码", async ({ request }) => {
    const resp = await request.get(`${BASE}/auth/challenge`);
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.code).toBe("string");
    expect(body.data.code.length).toBeGreaterThan(0);
  });

  rawTest("GET /api/auth/global 获取全局状态", async ({ request }) => {
    const resp = await request.get(`${BASE}/auth/global`);
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.isInitialized).toBe("boolean");

    // 已初始化时 global 必须下发 kdfParams，且内容为默认 argon2id 参数
    if (body.data.isInitialized) {
      expect(typeof body.data.kdfParams).toBe("string");
      expect(parseKdfParams(body.data.kdfParams)).toEqual(DEFAULT_KDF_PARAMS);
    }
  });

  rawTest("POST /api/auth/login 正确密码登录成功", async ({ request }) => {
    const challengeResp = await request.get(`${BASE}/auth/challenge`);
    const challengeCode = (await challengeResp.json()).data.code;

    const globalResp = await request.get(`${BASE}/auth/global`);
    const globalBody = await globalResp.json();
    const salt = globalBody.data.salt as string;

    // 用后端下发的 kdfParams 派生（经前端 parseKdfParams 严格校验）
    const kdfParams = parseKdfParams(globalBody.data.kdfParams);
    const { verifier } = await deriveMasterKey(
      PASSWORD,
      hexToBytes(salt),
      kdfParams,
    );
    const hash = sha512(bytesToHex(verifier) + challengeCode);
    const resp = await request.post(`${BASE}/auth/login`, {
      data: { hash },
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(typeof body.data.replayAttackSecret).toBe("string");
    expect(body.data.token.length).toBeGreaterThan(0);
    // v2：响应必须携带 keyBlob，且为 v2 自描述格式
    expect(typeof body.data.keyBlob).toBe("string");
    expect(body.data.keyBlob).toMatch(
      /^v2:aes-256-gcm:[0-9a-f]+:[0-9a-f]*:[0-9a-f]+$/,
    );
    // 登录响应下发 kdfParams，且与 global 下发的完全一致（同一份参数的闭环）
    expect(typeof body.data.kdfParams).toBe("string");
    expect(parseKdfParams(body.data.kdfParams)).toEqual(kdfParams);
    expect(parseKdfParams(body.data.kdfParams)).toEqual(DEFAULT_KDF_PARAMS);
    // salt 回显与 global 一致
    expect(body.data.salt).toBe(salt);
  });

  rawTest("POST /api/auth/login 错误密码返回 401", async ({ request }) => {
    // 锁定保护：同 IP 当日失败 ≥2 时跳过真实尝试（否则会把计数推到 3 触发
    // IP 锁定，导致后续所有登录 403）；计数 <2 时仅消耗 1 次，安全
    if ((await getLoginFailureCount(request)) >= 2) {
      rawTest.skip();
      return;
    }

    const challengeResp = await request.get(`${BASE}/auth/challenge`);
    const challengeCode = (await challengeResp.json()).data.code;

    const globalResp = await request.get(`${BASE}/auth/global`);
    const globalBody = await globalResp.json();
    const salt = globalBody.data.salt as string;

    // v2 流程但用错误密码派生（仅本次失败，不连续触发以避免 3 次 IP 锁定）
    const kdfParams = parseKdfParams(globalBody.data.kdfParams);
    const { verifier } = await deriveMasterKey(
      "wrong-password",
      hexToBytes(salt),
      kdfParams,
    );
    const hash = sha512(bytesToHex(verifier) + challengeCode);
    const resp = await request.post(`${BASE}/auth/login`, {
      data: { hash },
    });
    expect(resp.status()).toBe(401);
  });
});

test.describe("Auth API - 需认证接口", () => {
  test("POST /api/auth/logout 登出成功", async ({ request, session }) => {
    const url = "api/auth/logout";
    const resp = await request.post(`${BASE}/auth/logout`, {
      data: {},
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });
});

rawTest.describe("Auth API - 未认证拦截", () => {
  rawTest(
    "未携带 session token 访问受保护接口返回 401",
    async ({ request }) => {
      const resp = await request.post(`${BASE}/auth/logout`, {
        data: {},
      });
      expect(resp.status()).toBe(401);
    },
  );

  rawTest("无效 session token 访问受保护接口返回 401", async ({ request }) => {
    const resp = await request.post(`${BASE}/auth/logout`, {
      data: {},
      headers: { "X-Session-Token": "invalid-token" },
    });
    expect(resp.status()).toBe(401);
  });
});
