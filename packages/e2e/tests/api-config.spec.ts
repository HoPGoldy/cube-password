import { test, expect, authHeaders, BASE } from "../fixtures/api";

test.describe("Config API", () => {
  test("POST /api/config/version 获取版本信息", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/config/version`, {
      data: {},
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.version).toBe("string");
    expect(typeof body.data.name).toBe("string");
    expect(body.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("通用配置接口已移除：/api/config 与 /api/config/update 返回 404（防止旁路写 deviceGateEnabled）", async ({
    request,
    session,
  }) => {
    const read = await request.post(`${BASE}/config`, {
      data: {},
      headers: authHeaders(session),
    });
    expect(read.status()).toBe(404);

    const write = await request.post(`${BASE}/config/update`, {
      data: { deviceGateEnabled: "true" },
      headers: authHeaders(session),
    });
    expect(write.status()).toBe(404);
  });
});
