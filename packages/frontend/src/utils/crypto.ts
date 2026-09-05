import { sha512 as nobleSha512 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { bytesToHex } from "@/lib/e2ee/format";
import { nanoid } from "nanoid";

/**
 * SHA512 hash（大写 hex，输出与旧版实现保持一致）
 */
export const sha512 = (str: string) => {
  return bytesToHex(nobleSha512(utf8ToBytes(str))).toUpperCase();
};

/**
 * 生成防重放攻击 header
 */
export const createReplayAttackHeaders = (url: string, secretKey: string) => {
  const timestamp = Date.now();
  const nonce = nanoid();
  const sign = sha512(`${url}${nonce}${timestamp}${secretKey}`);

  return {
    "X-Timestamp": timestamp.toString(),
    "X-Nonce": nonce,
    "X-Signature": sign,
  };
};
