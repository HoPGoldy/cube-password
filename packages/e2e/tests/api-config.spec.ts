import { test, expect, authHeaders, BASE } from "../fixtures/api";
import { test as rawTest } from "@playwright/test";

test.describe("Config API", () => {
  test("GET /api/config/version 获取版本信息", async ({ request, session }) => {
    const url = "api/config/version";
    const resp = await request.get(`${BASE}/config/version`, {
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.version).toBe("string");
    expect(typeof body.data.name).toBe("string");
    expect(body.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("POST /api/config 获取配置列表", async ({ request, session }) => {
    const url = "api/config";
    const resp = await request.post(`${BASE}/config`, {
      data: {},
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data).toBe("object");
  });

  test("POST /api/config/update 更新配置", async ({ request, session }) => {
    const url = "api/config/update";
    const resp = await request.post(`${BASE}/config/update`, {
      data: { e2eTestKey: "e2e-test-value" },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
  });

  test("更新后配置值生效", async ({ request, session }) => {
    const updateUrl = "api/config/update";
    await request.post(`${BASE}/config/update`, {
      data: { e2eVerifyKey: "verify-value" },
      headers: authHeaders(session, updateUrl),
    });

    const readUrl = "api/config";
    const resp = await request.post(`${BASE}/config`, {
      data: {},
      headers: authHeaders(session, readUrl),
    });
    const body = await resp.json();
    expect(body.data.e2eVerifyKey).toBe("verify-value");
  });
});
