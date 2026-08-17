import { test, expect, authHeaders, BASE, sha512 } from "../fixtures/api";
import { test as rawTest } from "@playwright/test";

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
  });

  rawTest("POST /api/auth/login 正确密码登录成功", async ({ request }) => {
    const challengeResp = await request.get(`${BASE}/auth/challenge`);
    const challengeCode = (await challengeResp.json()).data.code;

    const globalResp = await request.get(`${BASE}/auth/global`);
    const salt = (await globalResp.json()).data.salt as string;

    // 加盐哈希：SHA512(SHA512(salt + password) + challengeCode)
    const hash = sha512(sha512(salt + PASSWORD) + challengeCode);
    const resp = await request.post(`${BASE}/auth/login`, {
      data: { hash, challengeCode },
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(typeof body.data.replayAttackSecret).toBe("string");
    expect(body.data.token.length).toBeGreaterThan(0);
  });

  rawTest("POST /api/auth/login 错误密码返回 401", async ({ request }) => {
    const challengeResp = await request.get(`${BASE}/auth/challenge`);
    const challengeCode = (await challengeResp.json()).data.code;

    const globalResp = await request.get(`${BASE}/auth/global`);
    const salt = (await globalResp.json()).data.salt as string;

    // 加盐哈希（错误密码）：SHA512(SHA512(salt + password) + challengeCode)
    const hash = sha512(sha512(salt + "wrong-password") + challengeCode);
    const resp = await request.post(`${BASE}/auth/login`, {
      data: { hash, challengeCode },
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
