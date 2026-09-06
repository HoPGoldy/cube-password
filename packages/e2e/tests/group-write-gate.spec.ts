import type { APIRequestContext } from "@playwright/test";
import {
  test,
  expect,
  authHeaders,
  BASE,
  encryptContent,
  sha512,
  deriveMasterKey,
  bytesToHex,
  hexToBytes,
  randomBytes,
  type SessionInfo,
} from "../fixtures/api";
import { parseKdfParams, DEFAULT_KDF_PARAMS } from "@frontend/lib/e2ee";

/**
 * 锁定分组的写操作门禁（PRD T02）：
 * CertificateService 的 add/update/delete/move/sort 对未解锁分组一律 403 拒绝；
 * search 为跨组分页读接口，明确不加门禁。
 *
 * fixtures 的 session fixture 为每个用例独立的新登录会话：
 * 登录时仅 lockType==='None' 的分组进入解锁集合，Password 锁分组处于锁定态。
 */
test.describe("Certificate group write gate", () => {
  const GROUP_PASSWORD = "e2e-gate-password";
  let lockedGroupId: number;
  let unlockedGroupId: number;
  let certId: number;

  /** 解锁 lockedGroupId（需在单个用例的 session 内完成，challenge 须为紧邻前一次请求） */
  async function unlockLockedGroup(
    request: APIRequestContext,
    session: SessionInfo,
  ) {
    const listResp = await request.post(`${BASE}/group/list`, {
      data: {},
      headers: authHeaders(session),
    });
    const found = (await listResp.json()).data.items.find(
      (g: { id: number }) => g.id === lockedGroupId,
    );
    const params = parseKdfParams(found.kdfParams);

    const challengeResp = await request.get(`${BASE}/auth/challenge`);
    const challengeCode = (await challengeResp.json()).data.code;

    const { verifier } = await deriveMasterKey(
      GROUP_PASSWORD,
      hexToBytes(found.salt),
      params,
    );
    const hash = sha512(bytesToHex(verifier) + challengeCode);

    const unlockResp = await request.post(`${BASE}/group/unlock`, {
      data: { id: lockedGroupId, hash },
      headers: authHeaders(session),
    });
    expect(unlockResp.status()).toBe(200);
  }

  test("准备：创建 Password 锁分组与无锁分组", async ({ request, session }) => {
    // Password 锁分组（argon2id v2 派生落库，保持锁定）
    const salt = randomBytes(32);
    const { verifier } = await deriveMasterKey(
      GROUP_PASSWORD,
      salt,
      DEFAULT_KDF_PARAMS,
    );
    const lockResp = await request.post(`${BASE}/group/add`, {
      data: {
        name: "write-gate-locked-group",
        lockType: "Password",
        passwordHash: bytesToHex(verifier),
        passwordSalt: bytesToHex(salt),
        kdfParams: JSON.stringify(DEFAULT_KDF_PARAMS),
      },
      headers: authHeaders(session),
    });
    expect(lockResp.status()).toBe(200);
    lockedGroupId = (await lockResp.json()).data.newId;

    // 无锁分组（None 登录即解锁，作为成功路径与 move 目标）
    const noneResp = await request.post(`${BASE}/group/add`, {
      data: { name: "write-gate-unlocked-group", lockType: "None" },
      headers: authHeaders(session),
    });
    expect(noneResp.status()).toBe(200);
    unlockedGroupId = (await noneResp.json()).data.newId;
  });

  test("准备：解锁后在锁定分组内建一个凭证（后续锁定态用例的操作对象）", async ({
    request,
    session,
  }) => {
    await unlockLockedGroup(request, session);

    const addResp = await request.post(`${BASE}/certificate/add`, {
      data: {
        groupId: lockedGroupId,
        name: "write-gate-cert",
        content: await encryptContent(session.dek, '{"k":"v"}'),
      },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);
    certId = (await addResp.json()).data.id;
  });

  test("POST /api/certificate/add 未解锁分组被 403 拒绝", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/add`, {
      data: { groupId: lockedGroupId, name: "should-fail" },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/certificate/update 未解锁分组被 403 拒绝", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/update`, {
      data: {
        id: certId,
        groupId: lockedGroupId,
        name: "should-fail-update",
      },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/certificate/update 锁定组凭证改 groupId 到已解锁组被 403 拒绝", async ({
    request,
    session,
  }) => {
    // 逃逸路径门禁：凭证在锁定组 A，update 改名并迁到已解锁组 B →
    // 若只校验目标组 B 会被放行，凭证即被搬出锁定组
    const resp = await request.post(`${BASE}/certificate/update`, {
      data: {
        id: certId,
        groupId: unlockedGroupId,
        name: "should-fail-escape",
      },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);

    // 副作用断言：凭证仍在原锁定组，未被改名/搬出（锁定态下 detail 仍 403；
    // 若被误迁到已解锁组，此处会变为 200）
    const detailResp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: certId },
      headers: authHeaders(session),
    });
    expect(detailResp.status()).toBe(403);
  });

  test("POST /api/certificate/delete 跨组 ids（锁定组+已解锁组）整体 403 拒绝", async ({
    request,
    session,
  }) => {
    // 在已解锁分组建一个凭证，与锁定组凭证一起传入 delete
    const addResp = await request.post(`${BASE}/certificate/add`, {
      data: { groupId: unlockedGroupId, name: "cross-group-cert" },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);
    const unlockedCertId = (await addResp.json()).data.id;

    const resp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [certId, unlockedCertId] },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);

    // 副作用断言：已解锁组内那个凭证也未被执行删除（整体拒绝，search 仍可查到）
    const searchResp = await request.post(`${BASE}/certificate/search`, {
      data: { keyword: "cross-group-cert", page: 1, pageSize: 10 },
      headers: authHeaders(session),
    });
    expect(searchResp.status()).toBe(200);
    const searchBody = await searchResp.json();
    const found = searchBody.data.items.find(
      (c: { id: number }) => c.id === unlockedCertId,
    );
    expect(found).toBeDefined();

    // 清理（所在组已解锁，可删）
    const delResp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [unlockedCertId] },
      headers: authHeaders(session),
    });
    expect(delResp.status()).toBe(200);
  });

  test("POST /api/certificate/delete 未解锁分组的凭证被 403 拒绝", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [certId] },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);

    // 凭证应原样保留（若被误删 detail 会 404 而非 403）
    const detailResp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: certId },
      headers: authHeaders(session),
    });
    expect(detailResp.status()).toBe(403);
  });

  test("POST /api/certificate/move 来源分组未解锁被 403 拒绝", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/move`, {
      data: { ids: [certId], newGroupId: unlockedGroupId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/certificate/move 目标分组未解锁被 403 拒绝", async ({
    request,
    session,
  }) => {
    // 在已解锁分组建一个凭证，再尝试移动到未解锁的 lockedGroupId
    const addResp = await request.post(`${BASE}/certificate/add`, {
      data: { groupId: unlockedGroupId, name: "move-source-cert" },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);
    const sourceCertId = (await addResp.json()).data.id;

    const resp = await request.post(`${BASE}/certificate/move`, {
      data: { ids: [sourceCertId], newGroupId: lockedGroupId },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);

    // 凭证应仍在原分组（detail 可访问）
    const detailResp = await request.post(`${BASE}/certificate/detail`, {
      data: { id: sourceCertId },
      headers: authHeaders(session),
    });
    expect(detailResp.status()).toBe(200);
    expect((await detailResp.json()).data.groupId).toBe(unlockedGroupId);

    // 清理该凭证（所在分组已解锁，可删）
    const delResp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [sourceCertId] },
      headers: authHeaders(session),
    });
    expect(delResp.status()).toBe(200);
  });

  test("POST /api/certificate/sort 未解锁分组的凭证被 403 拒绝", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/sort`, {
      data: { ids: [certId] },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/certificate/search 跨组搜索不加门禁（结果含锁定分组凭证）", async ({
    request,
    session,
  }) => {
    const resp = await request.post(`${BASE}/certificate/search`, {
      data: { keyword: "write-gate-cert", page: 1, pageSize: 10 },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    const found = body.data.items.find((c: { id: number }) => c.id === certId);
    expect(found).toBeDefined();
    expect(found.groupId).toBe(lockedGroupId);
  });

  test("解锁后 add/update/sort/move/delete 全部成功", async ({
    request,
    session,
  }) => {
    await unlockLockedGroup(request, session);

    // add（锁定分组）
    const addResp = await request.post(`${BASE}/certificate/add`, {
      data: { groupId: lockedGroupId, name: "unlocked-add-cert" },
      headers: authHeaders(session),
    });
    expect(addResp.status()).toBe(200);
    const addedCertId = (await addResp.json()).data.id;

    // update（锁定分组）
    const updateResp = await request.post(`${BASE}/certificate/update`, {
      data: {
        id: addedCertId,
        groupId: lockedGroupId,
        name: "unlocked-add-cert-renamed",
      },
      headers: authHeaders(session),
    });
    expect(updateResp.status()).toBe(200);

    // sort（锁定分组）
    const sortResp = await request.post(`${BASE}/certificate/sort`, {
      data: { ids: [addedCertId] },
      headers: authHeaders(session),
    });
    expect(sortResp.status()).toBe(200);

    // move：锁定分组 → 已解锁分组（来源+目标均解锁）
    const moveResp = await request.post(`${BASE}/certificate/move`, {
      data: { ids: [addedCertId], newGroupId: unlockedGroupId },
      headers: authHeaders(session),
    });
    expect(moveResp.status()).toBe(200);

    // move 回锁定分组（目标组已解锁，校验通过）
    const moveBackResp = await request.post(`${BASE}/certificate/move`, {
      data: { ids: [addedCertId], newGroupId: lockedGroupId },
      headers: authHeaders(session),
    });
    expect(moveBackResp.status()).toBe(200);

    // delete（锁定分组）
    const deleteResp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [addedCertId] },
      headers: authHeaders(session),
    });
    expect(deleteResp.status()).toBe(200);
  });

  test("清理：删除测试分组（连带凭证）", async ({ request, session }) => {
    // 解锁后删除锁定分组内的遗留凭证（write-gate-cert），再删分组
    await unlockLockedGroup(request, session);

    const deleteCertResp = await request.post(`${BASE}/certificate/delete`, {
      data: { ids: [certId] },
      headers: authHeaders(session),
    });
    expect(deleteCertResp.status()).toBe(200);

    const delLockedResp = await request.post(`${BASE}/group/delete`, {
      data: { id: lockedGroupId },
      headers: authHeaders(session),
    });
    expect(delLockedResp.status()).toBe(200);

    const delUnlockedResp = await request.post(`${BASE}/group/delete`, {
      data: { id: unlockedGroupId },
      headers: authHeaders(session),
    });
    expect(delUnlockedResp.status()).toBe(200);
  });
});
