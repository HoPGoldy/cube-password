import {
  test,
  expect,
  authHeaders,
  BASE,
  loginWithPassword,
  getLoginFailureCount,
  deriveMasterKey,
  type SessionInfo,
} from "../fixtures/api";
import crypto from "crypto";
import {
  bytesToHex,
  hexToBytes,
  randomBytes,
  wrapDek,
  unwrapDek,
  parseKdfParams,
  type KdfParams,
} from "@frontend/lib/e2ee";

/** 与 fixtures/api.ts 一致：SHA-512 大写 hex */
const sha512 = (str: string): string => {
  return crypto
    .createHash("sha512")
    .update(str, "utf8")
    .digest("hex")
    .toUpperCase();
};

/**
 * 改密码 API（O(1) re-wrap，与前端 change-password/content.tsx 语义一致）：
 * 验旧密码用登录下发的 kdfParams 派生旧 KEK（AEAD tag 即认证）；
 * 新密码沿用会话实际 kdfParams 派生，重包同一个 DEK；
 * 提交 { verifier, hash, salt, keyBlob }，其中 hash = SHA512(hex(V_old) + challengeCode)
 * 为旧密码证明（与 login 同构，后端 popLastChallenge 后比对库存 V）
 */
const changePasswordViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  session: SessionInfo,
  oldPassword: string,
  newPassword: string,
) => {
  // 1. 本地验旧密码：旧 KEK（登录下发的 kdfParams 派生）解 keyBlob 成功且 DEK 一致 = 旧密码正确；
  //    同一次派生的 verifier (V_old) 用于旧密码证明 hash
  const { kek: oldKek, verifier: oldVerifier } = await deriveMasterKey(
    oldPassword,
    hexToBytes(session.salt),
    session.kdfParams,
  );
  const dek = await unwrapDek(oldKek, session.keyBlob);
  expect(Buffer.from(dek).equals(Buffer.from(session.dek))).toBe(true);

  // 2. 新 salt → 新 (KEK, V) → 重包裹同一个 DEK（凭证零改动；
  //    与前端 change-password 页一致：新密码派生沿用会话实际 kdfParams，即库内当前值）
  const newSalt = randomBytes(32);
  const { kek: newKek, verifier: newVerifier } = await deriveMasterKey(
    newPassword,
    newSalt,
    session.kdfParams,
  );
  const newKeyBlob = await wrapDek(newKek, dek);

  // 3. challenge 必须是 change-password 前最后一次请求（后端 popLastChallenge），
  //    旧密码证明 hash = SHA512(hex(V_old) + challengeCode)
  const challengeResp = await request.post(`${BASE}/auth/challenge`, {
    data: {},
  });
  const challengeCode = (await challengeResp.json()).data.code as string;
  const resp = await request.post(`${BASE}/auth/change-password`, {
    data: {
      verifier: bytesToHex(newVerifier),
      hash: sha512(bytesToHex(oldVerifier) + challengeCode),
      salt: bytesToHex(newSalt),
      keyBlob: newKeyBlob,
    },
    headers: authHeaders(session),
  });
  const body = await resp.json();
  expect(body.success).toBe(true);

  return { newSalt: bytesToHex(newSalt), newKeyBlob };
};

test.describe("Change Password API（v2 re-wrap）", () => {
  const NEW_PASSWORD = "e2e-new-password-456";
  const DEFAULT_PASSWORD = "admin"; // E2E_LOGIN_PASSWORD 默认值，收尾恢复用
  let dekBefore: Buffer;
  let kdfParamsBefore: KdfParams;

  test("缺少 hash 的 change-password 请求被拒绝（旧密码证明缺失）", async ({
    request,
    session,
  }) => {
    const newSalt = randomBytes(32);
    const { kek: newKek, verifier: newVerifier } = await deriveMasterKey(
      NEW_PASSWORD,
      newSalt,
      session.kdfParams,
    );
    const newKeyBlob = await wrapDek(newKek, session.dek);

    // challenge 照常取（本次用例重点在 body 缺 hash）
    await request.post(`${BASE}/auth/challenge`, {
      data: {},
    });
    const resp = await request.post(`${BASE}/auth/change-password`, {
      data: {
        verifier: bytesToHex(newVerifier),
        salt: bytesToHex(newSalt),
        keyBlob: newKeyBlob,
      },
      headers: authHeaders(session),
    });
    // 缺 hash 走不到 service 的比对逻辑：Fastify schema 校验先拒绝
    // （FST_ERR_VALIDATION，经 unify-response 兼容层包装，历史行为即 500）；
    // 无论落在哪个状态码，核心断言是请求被拒且密码未被修改
    expect([400, 401, 403, 500]).toContain(resp.status());
    expect((await resp.json()).success).toBe(false);

    // 密码未被修改：默认密码仍可登录（session fixture 依赖）
    const restored = await loginWithPassword(request, DEFAULT_PASSWORD);
    expect(restored.token.length).toBeGreaterThan(0);
  });

  test("携带错误 hash 的 change-password 请求被拒绝（401）", async ({
    request,
    session,
  }) => {
    const newSalt = randomBytes(32);
    const { kek: newKek, verifier: newVerifier } = await deriveMasterKey(
      NEW_PASSWORD,
      newSalt,
      session.kdfParams,
    );
    const newKeyBlob = await wrapDek(newKek, session.dek);

    // hash 用错误密码派生的 V_old 计算：旧密码证明不成立
    const { verifier: wrongVerifier } = await deriveMasterKey(
      "wrong-password",
      hexToBytes(session.salt),
      session.kdfParams,
    );
    const challengeResp = await request.post(`${BASE}/auth/challenge`, {
      data: {},
    });
    const challengeCode = (await challengeResp.json()).data.code as string;
    const resp = await request.post(`${BASE}/auth/change-password`, {
      data: {
        verifier: bytesToHex(newVerifier),
        hash: sha512(bytesToHex(wrongVerifier) + challengeCode),
        salt: bytesToHex(newSalt),
        keyBlob: newKeyBlob,
      },
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(401);
    expect((await resp.json()).success).toBe(false);

    // 密码未被修改：默认密码仍可登录（session fixture 依赖）
    const restored = await loginWithPassword(request, DEFAULT_PASSWORD);
    expect(restored.token.length).toBeGreaterThan(0);
  });

  test("改密码后旧 session 保持有效且 re-wrap 结构正确", async ({
    request,
    session,
  }) => {
    dekBefore = Buffer.from(session.dek);
    kdfParamsBefore = session.kdfParams;

    const { newSalt, newKeyBlob } = await changePasswordViaApi(
      request,
      session,
      DEFAULT_PASSWORD,
      NEW_PASSWORD,
    );
    expect(newSalt).toMatch(/^[0-9a-f]+$/);
    expect(newKeyBlob).toMatch(/^v2:aes-256-gcm:/);

    // 后端不销毁 session：改完密码后旧 session 仍可调用受保护接口
    const resp = await request.post(`${BASE}/user/statistic`, {
      data: {},
      headers: authHeaders(session),
    });
    expect(resp.status()).toBe(200);
    expect((await resp.json()).success).toBe(true);
  });

  test("改密码后新密码可登录且解开同一个 DEK，旧密码失效", async ({
    request,
  }) => {
    // 新密码登录成功，KEK 解开的 DEK 与改密码前一致（全局 DEK 不变）
    const newSession = await loginWithPassword(request, NEW_PASSWORD);
    expect(Buffer.from(newSession.dek).equals(dekBefore)).toBe(true);

    // re-wrap 不改变 KDF 参数：改密码后 login/global 下发的 kdfParams 与改前一致
    expect(newSession.kdfParams).toEqual(kdfParamsBefore);

    // 旧密码登录失败（真实 401）。锁定保护：全局当日失败 ≥2 时跳过真实尝试
    // （再失败 1 次即达 3 次触发全局锁定，后续所有登录都会 403）；
    // 401 的后端路径已由 api-auth.spec 的负向用例在低计数时覆盖
    if ((await getLoginFailureCount(request)) < 2) {
      const globalResp = await request.post(`${BASE}/auth/global`, {
        data: {},
      });
      const globalBody = await globalResp.json();
      const salt = globalBody.data.salt as string;
      const challengeResp = await request.post(`${BASE}/auth/challenge`, {
        data: {},
      });
      const challengeCode = (await challengeResp.json()).data.code as string;
      const { verifier } = await deriveMasterKey(
        DEFAULT_PASSWORD,
        hexToBytes(salt),
        parseKdfParams(globalBody.data.kdfParams),
      );
      const oldHash = sha512(bytesToHex(verifier) + challengeCode);
      const oldLoginResp = await request.post(`${BASE}/auth/login`, {
        data: { hash: oldHash },
      });
      expect(oldLoginResp.status()).toBe(401);
    }
  });

  test("收尾：把密码改回默认，不影响其他 spec", async ({ request }) => {
    // 用新密码拿到有效凭证，再 re-wrap 回默认密码
    const s = await loginWithPassword(request, NEW_PASSWORD);
    await changePasswordViaApi(request, s, NEW_PASSWORD, DEFAULT_PASSWORD);

    // 验证默认密码可登录（其他 spec 的 session fixture 依赖它）
    const restored = await loginWithPassword(request, DEFAULT_PASSWORD);
    expect(restored.token.length).toBeGreaterThan(0);
  });
});
