import { createHash } from "node:crypto";

/**
 * 获取 sha512 hash（大写 hex）
 */
export const sha512 = (str: string) => {
  return createHash("sha512").update(str, "utf8").digest("hex").toUpperCase();
};

/**
 * 验证防重放攻击 header
 */
export const validateReplayAttack = (
  url: string,
  nonce: string,
  timestamp: number,
  signature: string,
  secretKey: string,
): boolean => {
  // 服务器时间和客户端时间相差 1 分钟以上，认为是无效请求
  if (Date.now() - timestamp > 60 * 1000) return false;

  const expectedSign = sha512(`${url}${nonce}${timestamp}${secretKey}`);
  return expectedSign === signature;
};
