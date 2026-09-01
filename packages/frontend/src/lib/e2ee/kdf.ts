/**
 * 密钥派生（KDF）：argon2id，基于 hash-wasm（纯 WASM，可同时运行于浏览器与 Node）
 *
 * 主密码 → argon2id(password, salt, { m=64MiB, t=2, p=1 }) → 64B
 *   ├─ [0:32]  = KEK（Key Encryption Key，仅内存，用于包裹/解包 DEK）
 *   └─ [32:64] = V（verifier，hex 存 User.passwordHash）
 */
import { argon2id } from "hash-wasm";

/** argon2id 参数（版本化存 User.kdfParams，调参无需迁移） */
export interface KdfParams {
  algorithm: "argon2id";
  /** 内存成本 KiB，默认 65536（64MiB） */
  m: number;
  /** 时间成本（迭代次数），默认 2 */
  t: number;
  /** 并行度，默认 1 */
  p: number;
  /** 参数结构版本 */
  version: number;
}

/** 默认参数（实施方案第 2 节决策） */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  m: 65536,
  t: 2,
  p: 1,
  version: 1,
};

/** kdfParams 字符串非法（JSON 非法、字段缺失或类型不符） */
export class ErrorInvalidKdfParams extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorInvalidKdfParams";
  }
}

/**
 * 解析并校验后端下发的 kdfParams JSON 字符串
 *
 * 只接受当前代码明确支持的 algorithm/version（argon2id / 1），其余直接抛错——
 * 版本化闭环的关键：参数不识别时必须显式失败，禁止静默回落默认值
 * （静默回落会导致派生出与库内 V 不一致的密钥，用户永远无法登录）。
 *
 * @throws {ErrorInvalidKdfParams} JSON 非法、字段缺失或类型不符时抛错
 */
export const parseKdfParams = (raw: string): KdfParams => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ErrorInvalidKdfParams("kdfParams 不是合法的 JSON 字符串");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ErrorInvalidKdfParams("kdfParams 必须是 JSON 对象");
  }

  const { algorithm, m, t, p, version } = parsed as Record<string, unknown>;

  if (algorithm !== "argon2id") {
    throw new ErrorInvalidKdfParams(
      `不支持的 KDF 算法 "${String(algorithm)}"（当前仅支持 argon2id），请升级应用`,
    );
  }
  if (typeof p !== "number" || !Number.isInteger(p) || p < 1) {
    throw new ErrorInvalidKdfParams("kdfParams.p 非法（须为 ≥ 1 的整数）");
  }
  if (typeof t !== "number" || !Number.isInteger(t) || t < 1) {
    throw new ErrorInvalidKdfParams("kdfParams.t 非法（须为 ≥ 1 的整数）");
  }
  if (typeof m !== "number" || !Number.isInteger(m) || m < 8 * p) {
    throw new ErrorInvalidKdfParams(
      `kdfParams.m 非法（须为 ≥ ${8 * p} 的整数，RFC 9106 最小内存限制）`,
    );
  }
  if (version !== 1) {
    throw new ErrorInvalidKdfParams(
      `不支持的 kdfParams 版本 ${String(version)}（当前支持 version 1），请升级应用`,
    );
  }

  return { algorithm: "argon2id", m, t, p, version };
};

/** KEK / verifier 长度（字节） */
export const KEK_LENGTH = 32;
/** verifier（V）长度（字节） */
export const VERIFIER_LENGTH = 32;
/** argon2id 总输出长度（字节） */
export const DERIVED_LENGTH = KEK_LENGTH + VERIFIER_LENGTH;
/** salt 长度（字节） */
export const SALT_LENGTH = 32;

const HASH_LENGTH_BYTES = DERIVED_LENGTH;

/**
 * 派生主密钥
 * @param password 主密码（UTF-8 编码后进 KDF）
 * @param saltBytes KDF salt（32 字节，前端 randomBytes 生成）
 * @param params argon2id 参数，默认 {@link DEFAULT_KDF_PARAMS}
 * @returns kek（前 32B，仅内存）与 verifier（后 32B，hex 后存 passwordHash）
 * @throws salt 为空或长度不足时抛错
 */
export const deriveMasterKey = async (
  password: string,
  saltBytes: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<{ kek: Uint8Array; verifier: Uint8Array }> => {
  if (!(saltBytes instanceof Uint8Array) || saltBytes.length === 0) {
    throw new Error("deriveMasterKey: salt must be a non-empty Uint8Array");
  }
  if (saltBytes.length < 8) {
    throw new Error(
      "deriveMasterKey: salt too short (min 8 bytes per RFC 9106)",
    );
  }

  const derived = await argon2id({
    password,
    salt: saltBytes,
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: HASH_LENGTH_BYTES,
    outputType: "binary",
  });

  return {
    kek: derived.slice(0, KEK_LENGTH),
    verifier: derived.slice(KEK_LENGTH, DERIVED_LENGTH),
  };
};
