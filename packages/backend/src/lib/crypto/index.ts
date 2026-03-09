import CryptoJS from "crypto-js";

const { SHA256, SHA512, AES, MD5, enc, mode, pad } = CryptoJS;

/**
 * 获取 sha512 hash
 */
export const sha512 = (str: string) => {
  return SHA512(str).toString(enc.Hex).toUpperCase();
};

/**
 * 获取带盐的 sha512 hash（兼容旧接口）
 */
export const shaWithSalt = (str: string, saltValue: string) => {
  const salt = SHA512(saltValue).toString(enc.Hex);
  const saltedMessage = salt + str;
  const hash = SHA512(saltedMessage);
  return hash.toString(enc.Hex).toUpperCase();
};

/**
 * 将密码转换为 AES 加密需要的 key 和 iv
 */
export const getAesMeta = (password: string) => {
  const key = enc.Utf8.parse(MD5(password).toString());
  const iv = enc.Utf8.parse(SHA256(password).toString());
  return { key, iv };
};

/**
 * AES 加密
 */
export const aesEncrypt = (
  str: string,
  key: CryptoJS.lib.WordArray,
  iv: CryptoJS.lib.WordArray,
) => {
  const srcs = enc.Utf8.parse(str);
  const encrypted = AES.encrypt(srcs, key, {
    iv,
    mode: mode.CBC,
    padding: pad.Pkcs7,
  });
  return encrypted.ciphertext.toString();
};

/**
 * AES 解密
 */
export const aesDecrypt = (
  str: string,
  key: CryptoJS.lib.WordArray,
  iv: CryptoJS.lib.WordArray,
) => {
  const encryptedHexStr = enc.Hex.parse(str);
  const srcs = enc.Base64.stringify(encryptedHexStr);
  const decrypt = AES.decrypt(srcs, key, {
    iv,
    mode: mode.CBC,
    padding: pad.Pkcs7,
  });
  return decrypt.toString(enc.Utf8);
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
