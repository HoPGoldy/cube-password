import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { argon2id } from "hash-wasm";
import crypto from "crypto";
import {
  buildV2,
  bytesToHex,
  hexToBytes,
  randomBytes,
  unwrapDek,
  V2_ALG_AES_256_GCM,
  parseKdfParams,
  DEFAULT_KDF_PARAMS,
  type KdfParams,
} from "@frontend/lib/e2ee";

const LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";
const BASE = "/api";

/** argon2id 输出 64B：前 32B = KEK，后 32B = V */
const KDF_HASH_LENGTH = 64;

/**
 * SHA-512 hash (uppercase hex)，与后端 node:crypto 及前端 @noble/hashes 一致
 */
export const sha512 = (str: string): string => {
  return crypto
    .createHash("sha512")
    .update(str, "utf8")
    .digest("hex")
    .toUpperCase();
};

/**
 * Node 与 DOM 两套 BufferSource 类型定义不一致（@types/node 要求
 * Uint8Array<ArrayBuffer>），测试环境 Node 运行时两者运行时行为相同，直接断言
 */
const asBufferSource = (b: Uint8Array): Uint8Array<ArrayBuffer> =>
  b as unknown as Uint8Array<ArrayBuffer>;

/**
 * 密钥派生：argon2id(password, salt) → 64B
 * 前 32B = KEK，后 32B = V（与前端 e2ee/kdf.ts 一致）
 * @param params KDF 参数，默认 {@link DEFAULT_KDF_PARAMS}；
 *   闭环场景应传后端下发的 kdfParams（经 parseKdfParams 校验）
 */
export const deriveMasterKey = async (
  password: string,
  saltBytes: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<{ kek: Uint8Array; verifier: Uint8Array }> => {
  const derived = await argon2id({
    password,
    salt: saltBytes,
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: KDF_HASH_LENGTH,
    outputType: "binary",
  });
  return {
    kek: derived.slice(0, 32),
    verifier: derived.slice(32, 64),
  };
};

/**
 * 解析后端下发的 kdfParams（经前端 parseKdfParams 严格校验）；
 * 未初始化库 /auth/global 不下发该字段，此时回落默认参数
 * @throws {ErrorInvalidKdfParams} 下发的参数非法或不被当前代码支持时抛错
 */
export const parseKdfParamsOrDefault = (raw?: string): KdfParams => {
  return raw ? parseKdfParams(raw) : DEFAULT_KDF_PARAMS;
};

/**
 * 用 DEK 加密凭证明文，输出 v2 自描述格式
 * `v2:aes-256-gcm:<nonce_hex>:<ciphertext_hex>:<tag_hex>`
 * （复用前端 e2ee 模块，保证与正式代码格式完全一致）
 */
export async function encryptContent(
  dek: Uint8Array,
  plaintext: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(dek),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const nonce = randomBytes(12);
  // WebCrypto 将 128-bit tag 附在密文末尾
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBufferSource(nonce), tagLength: 128 },
      key,
      new TextEncoder().encode(plaintext) as unknown as Uint8Array<ArrayBuffer>,
    ),
  );
  const ciphertext = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);
  return buildV2(
    V2_ALG_AES_256_GCM,
    asBufferSource(nonce),
    asBufferSource(ciphertext),
    asBufferSource(tag),
  );
}

interface SessionInfo {
  token: string;
  /** 登录解开 keyBlob 后的全局 DEK（凭证加密用） */
  dek: Uint8Array;
  /** 当前 KDF salt（hex） */
  salt: string;
  /** 当前 keyBlob（v2 格式，改密码 re-wrap 用） */
  keyBlob: string;
  /** 登录响应下发的 KDF 参数（经前端 parseKdfParams 校验） */
  kdfParams: KdfParams;
}

export type { SessionInfo };

/**
 * 通过 API 完成完整 v2 登录（可指定密码）：
 * global 取 salt/kdfParams → argon2id(password, salt, kdfParams) → V
 * → SHA512(hex(V) + challenge) → POST /auth/login
 * → 用 KEK 解开响应中的 keyBlob 得到 DEK
 */
export async function loginWithPassword(
  request: APIRequestContext,
  password: string,
): Promise<SessionInfo> {
  // 1. Get salt + kdfParams（GET /auth/global 不消费 challenge，可在 login 前任意顺序发起；
  //    kdfParams 未初始化时缺省，回落默认参数）
  const globalResp = await request.get(`${BASE}/auth/global`);
  const globalBody = await globalResp.json();
  expect(globalBody.success).toBe(true);
  const salt: string = globalBody.data.salt;
  const kdfParams = parseKdfParamsOrDefault(globalBody.data.kdfParams);

  // 2. Get challenge code
  //    后端 login 服务端自行 popLastChallenge，challenge 请求必须保持为 login 前最后一次发起的请求
  const challengeResp = await request.get(`${BASE}/auth/challenge`);
  const challengeBody = await challengeResp.json();
  expect(challengeBody.success).toBe(true);
  const challengeCode = challengeBody.data.code;

  // 3. argon2id → (KEK, V)，登录 hash = SHA512(hex(V) + challengeCode)
  const { kek, verifier } = await deriveMasterKey(
    password,
    hexToBytes(salt),
    kdfParams,
  );
  const hash = sha512(bytesToHex(verifier) + challengeCode);
  const resp = await request.post(`${BASE}/auth/login`, {
    data: { hash },
  });
  const body = await resp.json();
  expect(body.success).toBe(true);

  // 4. KEK 解开 keyBlob（AEAD tag 校验），得到全局 DEK
  const dek = await unwrapDek(kek, body.data.keyBlob);

  return {
    token: body.data.token,
    dek,
    salt,
    keyBlob: body.data.keyBlob,
    kdfParams,
  };
}

/** 使用 E2E_LOGIN_PASSWORD 登录（session fixture 用） */
async function loginViaApi(request: APIRequestContext): Promise<SessionInfo> {
  return loginWithPassword(request, LOGIN_PASSWORD);
}

/**
 * 全局登录失败计数（今日，来自 GET /auth/global）
 *
 * 后端锁定规则：全局当日失败 ≥ 3 次后，**所有**登录（含正确密码）都被拒绝。
 * 需要真实失败登录用例时，必须先用本函数检查计数，≥ 2 时跳过真实尝试，
 * 避免同日重复跑 e2e 时把登录锁死导致整个套件崩溃。
 */
export async function getLoginFailureCount(
  request: APIRequestContext,
): Promise<number> {
  const resp = await request.get(`${BASE}/auth/global`);
  const body = await resp.json();
  expect(body.success).toBe(true);
  return body.data.loginFailure.length as number;
}

/**
 * 构建认证 header (session token)
 */
export function authHeaders(session: SessionInfo): Record<string, string> {
  return {
    "X-Session-Token": session.token,
  };
}

interface ApiFixtures {
  /** 已认证的 session info */
  session: SessionInfo;
}

/**
 * 纯 API 测试 fixture
 * 提供自动登录后的 session（含解开的全局 DEK），搭配 request 使用
 */
export const test = base.extend<ApiFixtures>({
  session: async ({ request }, use) => {
    const s = await loginViaApi(request);
    await use(s);
  },
});

export { expect, BASE, randomBytes, hexToBytes, bytesToHex };
