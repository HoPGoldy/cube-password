import CryptoJS from "crypto-js";
import bcrypt from "bcryptjs";

/**
 * 获取 sha512 hash
 */
export const sha512 = (str: string) => {
  return CryptoJS.SHA512(str).toString(CryptoJS.enc.Hex).toUpperCase();
};

/**
 * 获取带盐的 sha512 hash（兼容旧接口）
 */
export const shaWithSalt = (str: string, saltValue: string) => {
  const salt = CryptoJS.SHA512(saltValue).toString(CryptoJS.enc.Hex);
  const saltedMessage = salt + str;
  const hash = CryptoJS.SHA512(saltedMessage);
  return hash.toString(CryptoJS.enc.Hex).toUpperCase();
};

/**
 * bcrypt 摘要存储
 * 落库的密码都要使用这个函数处理一下
 */
export const hashPassword = (password: string) => {
  return bcrypt.hashSync(password, 10);
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
