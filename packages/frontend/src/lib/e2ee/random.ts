/**
 * 随机字节生成封装（Web Crypto）
 */

/** 密码学安全随机字节，底层用 crypto.getRandomValues */
export const randomBytes = (length: number): Uint8Array => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`randomBytes: invalid length ${length}`);
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};
