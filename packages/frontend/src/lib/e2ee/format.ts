/**
 * v2 密文格式编解码（版本化自描述）
 *
 * 格式：`v2:<alg>:<nonce_hex>:<ciphertext_hex>:<tag_hex>`
 * - nonce 96-bit（12 字节），tag 128-bit（16 字节）
 * - 一律 hex 编码，与现有存储风格一致，便于调试
 * - 解析器按 `:` 切分并校验段数与前缀，格式非法直接抛错（不做静默兼容）
 */

/** 格式版本前缀 */
export const V2_PREFIX = "v2";
/** AES-256-GCM，nonce 96-bit，tag 128-bit */
export const V2_ALG_AES_256_GCM = "aes-256-gcm";
/** keyBlob / 凭证 content 共用的 v2 格式头 */
export const V2_ALG_PREFIX = `${V2_PREFIX}:${V2_ALG_AES_256_GCM}:`;

/** aes-256-gcm 分段的期望长度（字节数） */
const EXPECTED_LENGTHS = {
  nonce: 12,
  tag: 16,
} as const;

/** v2 格式非法（前缀 / 段数 / 算法 / hex / 长度任一校验不通过） */
export class ErrorInvalidV2Format extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorInvalidV2Format";
  }
}

/** 密文使用了当前代码不支持的算法（为未来扩展新算法预留） */
export class ErrorV2FormatUnsupportedAlgorithm extends ErrorInvalidV2Format {
  constructor(algorithm: string) {
    super(`v2 format: unsupported algorithm "${algorithm}"`);
    this.name = "ErrorV2FormatUnsupportedAlgorithm";
  }
}

/** 段数不符合 `<alg>:<nonce>:<ciphertext>:<tag>` 的期望 */
export class ErrorV2FormatUnexpectedSegmentCount extends ErrorInvalidV2Format {
  constructor(actual: number) {
    super(`v2 format: expected 5 segments, got ${actual}`);
    this.name = "ErrorV2FormatUnexpectedSegmentCount";
  }
}

export type V2Algorithm = typeof V2_ALG_AES_256_GCM;

/** 解析后的 v2 密文各段 */
export interface ParsedV2 {
  algorithm: V2Algorithm;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
}

/** 十六进制段校验（ciphertext 段允许为空：空明文加密后 ciphertext 为 0 字节） */
const assertValidHex = (
  value: string,
  field: string,
  { allowEmpty = false } = {},
): void => {
  if (value.length === 0) {
    if (!allowEmpty) {
      throw new ErrorInvalidV2Format(`v2 format: empty ${field} segment`);
    }
    return;
  }
  if (value.length % 2 !== 0) {
    throw new ErrorInvalidV2Format(`v2 format: odd-length ${field} hex`);
  }
  if (!/^[0-9a-f]+$/i.test(value)) {
    throw new ErrorInvalidV2Format(`v2 format: invalid hex in ${field}`);
  }
};

/** 字节转 hex（小写） */
export const bytesToHex = (bytes: Uint8Array): string => {
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

/** hex 转字节，非法输入抛 {@link ErrorInvalidV2Format} */
export const hexToBytes = (hex: string): Uint8Array => {
  assertValidHex(hex, "value");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * 拆分并校验 v2 密文格式字符串
 * @throws {ErrorInvalidV2Format} 前缀、段数、算法、hex 或分段长度非法时抛错
 */
export const parseV2 = (encoded: string): ParsedV2 => {
  if (typeof encoded !== "string" || !encoded.startsWith(`${V2_PREFIX}:`)) {
    throw new ErrorInvalidV2Format("v2 format: missing v2 prefix");
  }

  const segments = encoded.split(":");
  // v2:<alg>:<nonce>:<ciphertext>:<tag> → 5 段
  if (segments.length !== 5) {
    throw new ErrorV2FormatUnexpectedSegmentCount(segments.length);
  }

  const [, algorithm, nonceHex, ciphertextHex, tagHex] = segments;

  if (algorithm !== V2_ALG_AES_256_GCM) {
    throw new ErrorV2FormatUnsupportedAlgorithm(algorithm);
  }

  assertValidHex(nonceHex, "nonce");
  assertValidHex(ciphertextHex, "ciphertext", { allowEmpty: true });
  assertValidHex(tagHex, "tag");

  const nonce = hexToBytes(nonceHex);
  const ciphertext =
    ciphertextHex === "" ? new Uint8Array() : hexToBytes(ciphertextHex);
  const tag = hexToBytes(tagHex);

  if (nonce.length !== EXPECTED_LENGTHS.nonce) {
    throw new ErrorInvalidV2Format(
      `v2 format: nonce must be ${EXPECTED_LENGTHS.nonce} bytes, got ${nonce.length}`,
    );
  }
  if (tag.length !== EXPECTED_LENGTHS.tag) {
    throw new ErrorInvalidV2Format(
      `v2 format: tag must be ${EXPECTED_LENGTHS.tag} bytes, got ${tag.length}`,
    );
  }

  return { algorithm, nonce, ciphertext, tag };
};

/**
 * 将各段组装为 v2 密文格式字符串
 * （不校验长度，密钥学长度约束由 cipher 模块保证）
 */
export const buildV2 = (
  algorithm: V2Algorithm,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
): string =>
  [
    V2_PREFIX,
    algorithm,
    bytesToHex(nonce),
    bytesToHex(ciphertext),
    bytesToHex(tag),
  ].join(":");
