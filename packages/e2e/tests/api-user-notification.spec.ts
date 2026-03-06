import { test, expect, authHeaders, BASE } from "../fixtures/api";

test.describe("User API", () => {
  test("POST /api/user/statistic 获取统计信息", async ({
    request,
    session,
  }) => {
    const url = "api/user/statistic";
    const resp = await request.post(`${BASE}/user/statistic`, {
      data: {},
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.groupCount).toBe("number");
    expect(typeof body.data.certificateCount).toBe("number");
  });

  test("POST /api/user/set-theme 设置主题", async ({ request, session }) => {
    const url = "api/user/set-theme";
    const resp = await request.post(`${BASE}/user/set-theme`, {
      data: { theme: "dark" },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    // Reset back to light
    await request.post(`${BASE}/user/set-theme`, {
      data: { theme: "light" },
      headers: authHeaders(session, url),
    });
  });

  test("POST /api/user/create-pwd-setting 更新密码生成设置", async ({
    request,
    session,
  }) => {
    const url = "api/user/create-pwd-setting";
    const resp = await request.post(`${BASE}/user/create-pwd-setting`, {
      data: { createPwdAlphabet: "abc123", createPwdLength: 12 },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    // Reset to default
    await request.post(`${BASE}/user/create-pwd-setting`, {
      data: {
        createPwdAlphabet:
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*",
        createPwdLength: 16,
      },
      headers: authHeaders(session, url),
    });
  });
});

test.describe("Notification API", () => {
  test("POST /api/notification/list 获取通知列表", async ({
    request,
    session,
  }) => {
    const url = "api/notification/list";
    const resp = await request.post(`${BASE}/notification/list`, {
      data: { page: 1, pageSize: 10 },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(typeof body.data.total).toBe("number");
  });

  test("POST /api/notification/read-all 全部已读", async ({
    request,
    session,
  }) => {
    const url = "api/notification/read-all";
    const resp = await request.post(`${BASE}/notification/read-all`, {
      data: {},
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });

  test("POST /api/notification/remove-all 清空通知", async ({
    request,
    session,
  }) => {
    const url = "api/notification/remove-all";
    const resp = await request.post(`${BASE}/notification/remove-all`, {
      data: {},
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });
});
