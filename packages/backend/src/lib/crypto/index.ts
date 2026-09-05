import { createHash } from "node:crypto";

/**
 * 获取 sha512 hash（大写 hex）
 */
export const sha512 = (str: string) => {
  return createHash("sha512").update(str, "utf8").digest("hex").toUpperCase();
};
