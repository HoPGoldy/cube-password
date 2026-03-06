import { test as base, expect, type APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { nanoid } from "nanoid";

const LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const BASE = "/api";

/**
 * SHA-512 hash (uppercase hex)
 */
export const sha512 = (str: string): string => {
  return crypto.createHash("sha512").update(str).digest("hex").toUpperCase();
};

/**
 * 生成防重放攻击请求头
 */
export function createReplayHeaders(url: string, secretKey: string) {
  const nonce = nanoid();
  const timestamp = Date.now();
  const signature = sha512(`${url}${nonce}${timestamp}${secretKey}`);
  return {
    "X-Nonce": nonce,
    "X-Timestamp": String(timestamp),
    "X-Signature": signature,
  };
}

interface SessionInfo {
  token: string;
  replayAttackSecret: string;
}

/**
 * 通过 API 登录获取 session token + replay secret
 */
async function loginViaApi(request: APIRequestContext): Promise<SessionInfo> {
  // 1. Get challenge code
  const challengeResp = await request.get(`${BASE}/challenge`);
  const challengeBody = await challengeResp.json();
  expect(challengeBody.success).toBe(true);
  const challengeCode = challengeBody.data.code;

  // 2. Login with SHA512(password + challengeCode)
  const hash = sha512(LOGIN_PASSWORD + challengeCode);
  const resp = await request.post(`${BASE}/auth/login`, {
    data: { hash, challengeCode },
  });
  const body = await resp.json();
  expect(body.success).toBe(true);
  return {
    token: body.data.token,
    replayAttackSecret: body.data.replayAttackSecret,
  };
}

/**
 * 构建认证 header (session token + replay attack headers)
 */
export function authHeaders(
  session: SessionInfo,
  url: string,
): Record<string, string> {
  return {
    "X-Session-Token": session.token,
    ...createReplayHeaders(url, session.replayAttackSecret),
  };
}

interface ApiFixtures {
  /** 已认证的 session info */
  session: SessionInfo;
}

/**
 * 纯 API 测试 fixture
 * 提供自动登录后的 session，搭配 request 使用
 */
export const test = base.extend<ApiFixtures>({
  session: async ({ request }, use) => {
    const s = await loginViaApi(request);
    await use(s);
  },
});

export { expect, BASE };
