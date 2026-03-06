import { test, expect, authHeaders, BASE } from "../fixtures/api";
import { test as rawTest } from "@playwright/test";

test.describe("Access Token API", () => {
  let createdTokenId: string;
  let createdTokenPlain: string;

  test("POST /api/access-tokens 创建令牌", async ({ request, session }) => {
    const url = "api/access-tokens";
    const resp = await request.post(`${BASE}/access-tokens`, {
      data: { name: "api-e2e-test-token" },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("id");
    expect(body.data).toHaveProperty("token");
    expect(body.data).toHaveProperty("tokenPrefix");
    expect(body.data.name).toBe("api-e2e-test-token");
    expect(body.data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.token.startsWith(body.data.tokenPrefix)).toBe(true);

    createdTokenId = body.data.id;
    createdTokenPlain = body.data.token;
  });

  test("GET /api/access-tokens 列表包含已创建的令牌", async ({
    request,
    session,
  }) => {
    const url = "api/access-tokens";
    const resp = await request.get(`${BASE}/access-tokens`, {
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const found = body.data.find(
      (t: { id: string }) => t.id === createdTokenId,
    );
    expect(found).toBeDefined();
    expect(found.tokenHash).toBeUndefined();
    expect(found.token).toBeUndefined();
  });

  test("POST /api/access-tokens/exchange 有效令牌兑换 session", async ({
    request,
  }) => {
    const resp = await request.post(`${BASE}/access-tokens/exchange`, {
      data: { token: createdTokenPlain },
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.accessToken).toBe("string");
    expect(body.data.accessToken.length).toBeGreaterThan(0);
  });

  test("POST /api/access-tokens/exchange 无效令牌返回 401", async ({
    request,
  }) => {
    const resp = await request.post(`${BASE}/access-tokens/exchange`, {
      data: {
        token:
          "0000000000000000000000000000000000000000000000000000000000000000",
      },
    });
    expect(resp.status()).toBe(401);
  });

  test("DELETE /api/access-tokens/:id 删除令牌", async ({
    request,
    session,
  }) => {
    const url = `api/access-tokens/${createdTokenId}`;
    const resp = await request.delete(
      `${BASE}/access-tokens/${createdTokenId}`,
      {
        headers: authHeaders(session, url),
      },
    );
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
  });

  test("删除后令牌不再出现在列表中", async ({ request, session }) => {
    const url = "api/access-tokens";
    const resp = await request.get(`${BASE}/access-tokens`, {
      headers: authHeaders(session, url),
    });
    const body = await resp.json();
    const found = body.data.find(
      (t: { id: string }) => t.id === createdTokenId,
    );
    expect(found).toBeUndefined();
  });

  test("删除后令牌兑换返回 401", async ({ request }) => {
    const resp = await request.post(`${BASE}/access-tokens/exchange`, {
      data: { token: createdTokenPlain },
    });
    expect(resp.status()).toBe(401);
  });
});

rawTest.describe("Access Token API - 未认证拦截", () => {
  rawTest("未登录创建令牌返回 401", async ({ request }) => {
    const resp = await request.post(`${BASE}/access-tokens`, {
      data: { name: "should-fail" },
    });
    expect(resp.status()).toBe(401);
  });

  rawTest("未登录获取列表返回 401", async ({ request }) => {
    const resp = await request.get(`${BASE}/access-tokens`);
    expect(resp.status()).toBe(401);
  });
});
