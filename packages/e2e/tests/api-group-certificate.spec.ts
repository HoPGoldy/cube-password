import {
  test,
  expect,
  authHeaders,
  BASE,
  encryptContent,
  decryptContent,
  sha512,
  deriveMasterKey,
  bytesToHex,
  hexToBytes,
  randomBytes,
} from "../fixtures/api";
import { parseKdfParams, DEFAULT_KDF_PARAMS } from "@frontend/lib/e2ee";

test.describe("Group API", () => {
  let createdGroupId: number;

  test("POST /api/group/add 创建分组", async ({ request, session }) => {
    const resp = await request.post(`${BASE}/group/add`, {
      data: { name: "e2e-test-group", lockType: "None" },
      headers: authHeaders(session),
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
    const resp = await request.post(`${BASE}/group/list`, {
      data: {},
      headers: authHeaders(session),
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
    const resp = await request.post(`${BASE}/group/update-name`, {
      data: { id: createdGroupId, name: "e2e-renamed" },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
  });

  test("POST /api/group/set-default 设为默认分组", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/group/set-default`, {
      data: { id: createdGroupId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
  });

  test("POST /api/group/delete 删除分组", async ({ request, session }) => {
    const resp = await request.post(`${BASE}/group/delete`, {
      data: { id: createdGroupId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
  });
});

test.describe("Group Password Lock (argon2id v2)", () => {
  const GROUP_PASSWORD = "e2e-group-password";
  let groupId: number;

  test("准备：创建 Password 锁分组（v2 派生落库）", async ({
    request,
    session,
  }) => {
    // v2：argon2id(password, salt, kdfParams) → 64B，前 32B KEK（分组场景丢弃）
    // + 后 32B V；存 passwordHash = hex(V)，与主密码同构
    const salt = randomBytes(32);
    const { verifier } = await deriveMasterKey(
      GROUP_PASSWORD,
      salt,
      DEFAULT_KDF_PARAMS,
    );
    const resp = await request.post(`${BASE}/group/add`, {
      data: {
        name: "locked-group",
        lockType: "Password",
        passwordHash: bytesToHex(verifier),
        passwordSalt: bytesToHex(salt),
        kdfParams: JSON.stringify(DEFAULT_KDF_PARAMS),
      },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    groupId = body.data.newId;
  });

  test("POST /api/group/list 下发 salt + kdfParams（kdfParams 非空）", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/group/list`, {
      data: {},
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    const found = body.data.items.find((g: { id: number }) => g.id === groupId);
    expect(found).toBeDefined();
    expect(found.lockType).toBe("Password");
    // salt 为 64 位 hex（32 字节）
    expect(found.salt).toMatch(/^[0-9a-f]{64}$/);
    // kdfParams 非空且可被 parseKdfParams 严格校验
    expect(typeof found.kdfParams).toBe("string");
    expect(found.kdfParams.length).toBeGreaterThan(0);
    expect(parseKdfParams(found.kdfParams)).toEqual(DEFAULT_KDF_PARAMS);
  });

  test("POST /api/group/unlock 正确密码解锁成功", async ({
    request,
    session,
  }) => {
    // 从 list 拿 salt/kdfParams（与前端解锁流程同源）
    const listResp = await request.post(`${BASE}/group/list`, {
      data: {},
      headers: authHeaders(session),
    });
    const found = (await listResp.json()).data.items.find(
      (g: { id: number }) => g.id === groupId,
    );
    const params = parseKdfParams(found.kdfParams);

    // challenge 必须是 unlock 前紧邻的最后一次请求
    const challengeResp = await request.post(`${BASE}/auth/challenge`, {
      data: {},
    });
    const challengeCode = (await challengeResp.json()).data.code;

    const { verifier } = await deriveMasterKey(
      GROUP_PASSWORD,
      hexToBytes(found.salt),
      params,
    );
    const hash = sha512(bytesToHex(verifier) + challengeCode);

    const resp = await request.post(`${BASE}/group/unlock`, {
      data: { id: groupId, hash },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
  });

  test("POST /api/group/unlock 错误密码解锁失败", async ({
    request,
    session,
  }) => {
    const listResp = await request.post(`${BASE}/group/list`, {
      data: {},
      headers: authHeaders(session),
    });
    const found = (await listResp.json()).data.items.find(
      (g: { id: number }) => g.id === groupId,
    );
    const params = parseKdfParams(found.kdfParams);

    const challengeResp = await request.post(`${BASE}/auth/challenge`, {
      data: {},
    });
    const challengeCode = (await challengeResp.json()).data.code;

    const { verifier } = await deriveMasterKey(
      "wrong-group-password",
      hexToBytes(found.salt),
      params,
    );
    const hash = sha512(bytesToHex(verifier) + challengeCode);

    const resp = await request.post(`${BASE}/group/unlock`, {
      data: { id: groupId, hash },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(400);

    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/group/unlock 旧格式（kdfParams=空串）得到重新设置提示", async ({
    request,
    session,
  }) => {
    // 模拟 v1 遗留形态：kdfParams 落空串，passwordHash 为 sha512(salt+pwd)（不可逆推，任意值即可）
    const v1Salt = "legacy-v1-salt";
    const addResp = await request.post(`${BASE}/group/add`, {
      data: {
        name: "legacy-locked-group",
        lockType: "Password",
        passwordHash: sha512(v1Salt + "legacy-v1-password"),
        passwordSalt: v1Salt,
        kdfParams: "",
      },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);
    const legacyGroupId = (await addResp.json()).data.newId;

    try {
      // challenge 必须是 unlock 前紧邻的最后一次请求
      const challengeResp = await request.post(`${BASE}/auth/challenge`, {
        data: {},
      });
      const challengeCode = (await challengeResp.json()).data.code;

      const unlockResp = await request.post(`${BASE}/group/unlock`, {
        data: { id: legacyGroupId, hash: sha512("anything" + challengeCode) },
        headers: authHeaders(session),
      });
      expect(unlockResp.status()).toBe(400);

      const body = await unlockResp.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain("重新设置");
    } finally {
      // 清理
      const delResp = await request.post(`${BASE}/group/delete`, {
        data: { id: legacyGroupId },
        headers: authHeaders(session),
      });
      expect(delResp.status()).toBe(200);
    }
  });

  test("清理：删除锁定分组", async ({ request, session }) => {
    const resp = await request.post(`${BASE}/group/delete`, {
      data: { id: groupId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
  });
});

test.describe("Certificate API", () => {
  let groupId: number;
  let certId: number;

  test("准备：创建测试分组", async ({ request, session }) => {
    const resp = await request.post(`${BASE}/group/add`, {
      data: { name: "cert-test-group", lockType: "None" },
      headers: authHeaders(session),
    });
    const body = await resp.json();
    groupId = body.data.newId;
  });

  // 元数据加密：新前端只传 nameEnc（v2 密文），不再传明文 name
  const certPlaintext = JSON.stringify([
    { label: "网址", value: "https://example.com" },
    { label: "用户名", value: "e2e-user" },
    { label: "密码", value: "e2e-pass" },
  ]);
  const certName = "e2e-cert";
  let certContent: string;
  let certNameEnc: string;

  test("POST /api/certificate/add 创建凭证", async ({ request, session }) => {
    certContent = await encryptContent(session.dek, certPlaintext);
    certNameEnc = await encryptContent(session.dek, certName);
    const resp = await request.post(`${BASE}/certificate/add`, {
      data: {
        groupId,
        nameEnc: certNameEnc,
        icon: "",
        markColor: "#ff0000",
        content: certContent,
      },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.id).toBe("number");
    certId = body.data.id;
  });

  test("POST /api/certificate/list 列表包含凭证且名称走 nameEnc", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/list`, {
      data: { groupId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);

    const found = body.data.items.find((c: { id: number }) => c.id === certId);
    expect(found).toBeDefined();
    // 新建后明文 name 列为空串（停止业务写入），名称密文可解回原文
    expect(found.name).toBe("");
    expect(found.nameEnc).toMatch(/^v2:aes-256-gcm:/);
    expect(await decryptContent(session.dek, found.nameEnc)).toBe(certName);
  });

  test("POST /api/certificate/detail 获取凭证详情", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: certId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(await decryptContent(session.dek, body.data.nameEnc)).toBe(certName);
    expect(body.data.content).toBe(certContent);
  });

  test("POST /api/certificate/index 全量索引（含 nameEnc/groupId，无明文名）", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/index`, {
      data: {},
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.success).toBe(true);
    const found = body.data.items.find((c: { id: number }) => c.id === certId);
    expect(found).toBeDefined();
    expect(found.groupId).toBe(groupId);
    expect(await decryptContent(session.dek, found.nameEnc)).toBe(certName);
    expect(found.name).toBeUndefined();
    expect(found.content).toBeUndefined();
  });

  test("POST /api/certificate/update 更新凭证（改名走 nameEnc）", async ({
    request,
    session,
  }) => {
    const newNameEnc = await encryptContent(session.dek, "e2e-cert-updated");
    const resp = await request.post(`${BASE}/certificate/update`, {
      data: {
        id: certId,
        groupId,
        nameEnc: newNameEnc,
        icon: "",
        markColor: "#00ff00",
        content: await encryptContent(
          session.dek,
          JSON.stringify([
            { label: "网址", value: "https://updated.com" },
            { label: "用户名", value: "updated-user" },
            { label: "密码", value: "updated-pass" },
          ]),
        ),
      },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);

    // 回读：改名后的 nameEnc 可解回新名，明文 name 仍为空串
    const detailResp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: certId },
      headers: authHeaders(session),
    });
    const detail = (await detailResp.json()).data;
    expect(detail.name).toBe("");
    expect(await decryptContent(session.dek, detail.nameEnc)).toBe(
      "e2e-cert-updated",
    );
  });

  test("POST /api/certificate/search 接口已删除（404）", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/search`, {
      data: { keyword: "e2e-cert", page: 1, pageSize: 10 },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(404);
  });

  test("POST /api/certificate/delete 删除凭证", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [certId] },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
  });

  test("清理：删除测试分组", async ({ request, session }) => {
    await request.post(`${BASE}/group/delete`, {
      data: { id: groupId },
      headers: authHeaders(session),
    });
  });
});
