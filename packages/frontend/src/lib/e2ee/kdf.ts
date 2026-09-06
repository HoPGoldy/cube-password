/**
 * 密钥派生（KDF）：argon2id，基于 hash-wasm（纯 WASM，可同时运行于浏览器与 Node）
 *
 * 主密码 → argon2id(password, salt, { m=64MiB, t=2, p=1 }) → 64B
 *   ├─ [0:32]  = KEK（Key Encryption Key，仅内存，用于包裹/解包 DEK）
 *   └─ [32:64] = V（verifier，hex 存 User.passwordHash）
 */
import { argon2id } from "hash-wasm";

// KDF 参数定义与校验的唯一实现位于 @cube-password/shared，此处 re-export
// 保持 @/lib/e2ee 对外接口不变（组件与 e2e fixtures 零改动）
export type { KdfParams } from "@cube-password/shared/kdf-params";
export {
  DEFAULT_KDF_PARAMS,
  ErrorInvalidKdfParams,
  parseKdfParams,
} from "@cube-password/shared/kdf-params";

import {
  DEFAULT_KDF_PARAMS,
  type KdfParams,
} from "@cube-password/shared/kdf-params";

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
