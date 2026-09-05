import { sha512 as nobleSha512 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { bytesToHex } from "@/lib/e2ee/format";

/**
 * SHA512 hash（大写 hex，输出与旧版实现保持一致）
 */
export const sha512 = (str: string) => {
  return bytesToHex(nobleSha512(utf8ToBytes(str))).toUpperCase();
};
