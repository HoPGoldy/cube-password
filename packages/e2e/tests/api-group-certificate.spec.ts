import { test, expect, authHeaders, BASE } from "../fixtures/api";

test.describe("Group API", () => {
  let createdGroupId: number;

  test("POST /api/group/add 创建分组", async ({ request, session }) => {
    const url = "api/group/add";
    const resp = await request.post(`${BASE}/group/add`, {
      data: { name: "e2e-test-group", lockType: "None" },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.newId).toBe("number");
    createdGroupId = body.data.newId;
  });

  test("POST /api/group/list 列表包含已创建的分组", async ({
    request,
    session,
  }) => {
    const url = "api/group/list";
    const resp = await request.post(`${BASE}/group/list`, {
      data: {},
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);

    const found = body.data.items.find(
      (g: { id: number }) => g.id === createdGroupId,
    );
    expect(found).toBeDefined();
    expect(found.name).toBe("e2e-test-group");
  });

  test("POST /api/group/update-name 重命名分组", async ({
    request,
    session,
  }) => {
    const url = "api/group/update-name";
    const resp = await request.post(`${BASE}/group/update-name`, {
      data: { id: createdGroupId, name: "e2e-renamed" },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });

  test("POST /api/group/set-default 设为默认分组", async ({
    request,
    session,
  }) => {
    const url = "api/group/set-default";
    const resp = await request.post(`${BASE}/group/set-default`, {
      data: { id: createdGroupId },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });

  test("POST /api/group/delete 删除分组", async ({ request, session }) => {
    const url = "api/group/delete";
    const resp = await request.post(`${BASE}/group/delete`, {
      data: { id: createdGroupId },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });
});

test.describe("Certificate API", () => {
  let groupId: number;
  let certId: number;

  test("准备：创建测试分组", async ({ request, session }) => {
    const url = "api/group/add";
    const resp = await request.post(`${BASE}/group/add`, {
      data: { name: "cert-test-group", lockType: "None" },
      headers: authHeaders(session, url),
    });
    const body = await resp.json();
    groupId = body.data.newId;
  });

  test("POST /api/certificate/add 创建凭证", async ({ request, session }) => {
    const url = "api/certificate/add";
    const resp = await request.post(`${BASE}/certificate/add`, {
      data: {
        groupId,
        name: "e2e-cert",
        icon: "",
        markColor: "#ff0000",
        content: "encrypted-content",
      },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.id).toBe("number");
    certId = body.data.id;
  });

  test("POST /api/certificate/list 列表包含凭证", async ({
    request,
    session,
  }) => {
    const url = "api/certificate/list";
    const resp = await request.post(`${BASE}/certificate/list`, {
      data: { groupId },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);

    const found = body.data.items.find((c: { id: number }) => c.id === certId);
    expect(found).toBeDefined();
    expect(found.name).toBe("e2e-cert");
  });

  test("POST /api/certificate/detail 获取凭证详情", async ({
    request,
    session,
  }) => {
    const url = "api/certificate/detail";
    const resp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: certId },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("e2e-cert");
    expect(body.data.content).toBe("encrypted-content");
  });

  test("POST /api/certificate/update 更新凭证", async ({
    request,
    session,
  }) => {
    const url = "api/certificate/update";
    const resp = await request.post(`${BASE}/certificate/update`, {
      data: {
        id: certId,
        groupId,
        name: "e2e-cert-updated",
        icon: "",
        markColor: "#00ff00",
        content: "updated-content",
      },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });

  test("POST /api/certificate/search 搜索凭证", async ({
    request,
    session,
  }) => {
    const url = "api/certificate/search";
    const resp = await request.post(`${BASE}/certificate/search`, {
      data: { keyword: "e2e-cert", page: 1, pageSize: 10 },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/certificate/delete 删除凭证", async ({
    request,
    session,
  }) => {
    const url = "api/certificate/delete";
    const resp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [certId] },
      headers: authHeaders(session, url),
    });
    expect(resp.status()).toBe(200);
  });

  test("清理：删除测试分组", async ({ request, session }) => {
    const url = "api/group/delete";
    await request.post(`${BASE}/group/delete`, {
      data: { id: groupId },
      headers: authHeaders(session, url),
    });
  });
});
