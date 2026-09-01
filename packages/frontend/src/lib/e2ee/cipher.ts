/**
 * 对称加解密（AES-256-GCM，WebCrypto）
 *
 * - 凭证 content / keyBlob 共用 v2 自描述格式（见 format.ts）
 * - AEAD tag 校验 = 解密即认证：密文或 keyBlob 被篡改时解密必抛错
 */
import { V2_ALG_AES_256_GCM, buildV2, parseV2 } from "./format";

/** AES-GCM 算法标识（WebCrypto） */
const WEB_CRYPTO_ALGORITHM = "AES-GCM";
/** nonce 96-bit */
const NONCE_LENGTH = 12;
/** DEK / KEK 长度 256-bit */
const KEY_LENGTH = 32;
/** GCM tag 128-bit */
const TAG_LENGTH = 128;
/** wrapDek 明文结构版本头（预留未来密钥长度/算法扩展） */
const DEK_BLOB_VERSION = 1;

/** 密钥材料非法（长度或类型不符） */
export class ErrorInvalidKey extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorInvalidKey";
  }
}

/** keyBlob 解出的版本头不被当前代码支持（未来版本号的 keyBlob） */
export class ErrorUnsupportedDekVersion extends Error {
  constructor(version: number) {
    super(
      `unsupported keyBlob version ${version} (this code supports version ${DEK_BLOB_VERSION})`,
    );
    this.name = "ErrorUnsupportedDekVersion";
  }
}

/** 密钥材料校验（DEK / KEK 共用）：32 字节 Uint8Array */
const assertKeyBytes = (key: Uint8Array): Uint8Array => {
  if (!(key instanceof Uint8Array)) {
    throw new ErrorInvalidKey("key must be a Uint8Array");
  }
  if (key.length !== KEY_LENGTH) {
    throw new ErrorInvalidKey(
      `key must be ${KEY_LENGTH} bytes, got ${key.length}`,
    );
  }
  return key;
};

/** 解包后的 DEK 长度校验（AEAD tag 保证来源，长度是最后一道防线） */
const assertDekBytes = (dek: Uint8Array): Uint8Array => {
  if (!(dek instanceof Uint8Array)) {
    throw new ErrorInvalidKey("plaintext must decode to a Uint8Array");
  }
  if (dek.length !== KEY_LENGTH) {
    throw new ErrorInvalidKey(
      `plaintext must decode to a ${KEY_LENGTH}-byte key, got ${dek.length}`,
    );
  }
  return dek;
};

const importAesKey = async (keyBytes: Uint8Array): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: WEB_CRYPTO_ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
};

/** AEAD 认证失败（tag 不匹配：密钥错误或密文被篡改） */
export class ErrorDecryptionFailed extends Error {
  constructor(
    message = "AES-GCM decryption failed (wrong key or tampered data)",
  ) {
    super(message);
    this.name = "ErrorDecryptionFailed";
  }
}

/**
 * AES-GCM 加密，返回分离的 nonce / ciphertext / tag
 */
const gcmEncrypt = async (
  keyBytes: Uint8Array,
  plaintext: Uint8Array,
): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array; tag: Uint8Array }> => {
  assertKeyBytes(keyBytes);

  const nonce = new Uint8Array(NONCE_LENGTH);
  crypto.getRandomValues(nonce);

  const cryptoKey = await importAesKey(keyBytes);
  // WebCrypto 将 tag 附在密文末尾，这里显式分离
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: WEB_CRYPTO_ALGORITHM,
        iv: nonce as BufferSource,
        tagLength: TAG_LENGTH,
      },
      cryptoKey,
      plaintext as BufferSource,
    ),
  );
  const ciphertext = encrypted.slice(0, encrypted.length - TAG_LENGTH / 8);
  const tag = encrypted.slice(encrypted.length - TAG_LENGTH / 8);

  return { nonce, ciphertext, tag };
};

/**
 * AES-GCM 解密（nonce / ciphertext / tag 分离形态），AEAD 校验失败抛错
 */
const gcmDecrypt = async (
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
): Promise<Uint8Array> => {
  const cryptoKey = await importAesKey(assertKeyBytes(keyBytes));

  // WebCrypto 期望 tag 附在密文末尾
  const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(tag, ciphertext.length);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: WEB_CRYPTO_ALGORITHM,
        iv: nonce as BufferSource,
        tagLength: TAG_LENGTH,
      },
      cryptoKey,
      ciphertextWithTag as BufferSource,
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new ErrorDecryptionFailed();
  }
};

/**
 * 用 DEK 加密凭证明文，输出 v2 格式字符串
 * `v2:aes-256-gcm:<nonce_hex>:<ciphertext_hex>:<tag_hex>`
 */
export const encryptContent = async (
  dek: Uint8Array,
  plaintext: string,
): Promise<string> => {
  const encodedPlaintext = new TextEncoder().encode(plaintext);
  const { nonce, ciphertext, tag } = await gcmEncrypt(dek, encodedPlaintext);
  return buildV2(V2_ALG_AES_256_GCM, nonce, ciphertext, tag);
};

/**
 * 用 DEK 解密 v2 格式密文
 * @throws {ErrorInvalidV2Format} 格式非法
 * @throws {ErrorDecryptionFailed} DEK 错误或密文被篡改
 */
export const decryptContent = async (
  dek: Uint8Array,
  encoded: string,
): Promise<string> => {
  const { nonce, ciphertext, tag } = parseV2(encoded);
  const decrypted = await gcmDecrypt(dek, nonce, ciphertext, tag);
  return new TextDecoder().decode(decrypted);
};

/**
 * 用 KEK 包裹 DEK，生成 v2 格式 keyBlob 字符串
 * DEK 序列化为 1 字节版本头（0x01，预留未来密钥长度/算法扩展）+ 32 字节 key
 */
export const wrapDek = async (
  kek: Uint8Array,
  dek: Uint8Array,
): Promise<string> => {
  assertDekBytes(dek);

  const dekWithHeader = new Uint8Array(1 + dek.length);
  dekWithHeader[0] = DEK_BLOB_VERSION;
  dekWithHeader.set(dek, 1);

  const { nonce, ciphertext, tag } = await gcmEncrypt(kek, dekWithHeader);
  return buildV2(V2_ALG_AES_256_GCM, nonce, ciphertext, tag);
};

/**
 * 用 KEK 解开 v2 格式 keyBlob，还原 DEK
 * @throws {ErrorInvalidV2Format} 格式非法
 * @throws {ErrorDecryptionFailed} KEK 错误（即主密码错误）或 keyBlob 被篡改
 * @throws {ErrorUnsupportedDekVersion} 解出的版本头不是当前支持的 {@link DEK_BLOB_VERSION}
 */
export const unwrapDek = async (
  kek: Uint8Array,
  keyBlob: string,
): Promise<Uint8Array> => {
  const { nonce, ciphertext, tag } = parseV2(keyBlob);
  const dekWithHeader = await gcmDecrypt(kek, nonce, ciphertext, tag);

  if (dekWithHeader.length < 1) {
    throw new ErrorDecryptionFailed("keyBlob plaintext is empty");
  }
  const version = dekWithHeader[0];
  if (version !== DEK_BLOB_VERSION) {
    throw new ErrorUnsupportedDekVersion(version);
  }

  return assertDekBytes(dekWithHeader.slice(1));
};
