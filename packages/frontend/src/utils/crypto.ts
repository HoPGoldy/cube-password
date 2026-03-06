import CryptoJS from "crypto-js";
import { nanoid } from "nanoid";

const { SHA256, SHA512, AES, MD5, enc, mode, pad } = CryptoJS;

/**
 * SHA512 hash
 */
export const sha512 = (str: string) => {
  return SHA512(str).toString().toUpperCase();
};

/**
 * 获取 sha512 hash (带盐)
 */
export const shaWithSalt = (str: string, saltValue: string) => {
  const salt = SHA512(saltValue).toString(CryptoJS.enc.Hex);
  const saltedMessage = salt + str;
  const hash = SHA512(saltedMessage);
  return hash.toString(CryptoJS.enc.Hex).toUpperCase();
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

/**
 * 将密码转换为 aes 加密需要的 key 和初始向量
 */
export const getAesMeta = (password: string) => {
  const key = enc.Utf8.parse(MD5(password).toString());
  const iv = enc.Utf8.parse(SHA256(password).toString());

  return { key, iv };
};

/**
 * 验证 aes 加密信息
 * 用于判断 key 和 iv 是否是从这个密码生成的
 */
export const validateAesMeta = (
  password: string,
  key: CryptoJS.lib.WordArray,
  iv: CryptoJS.lib.WordArray,
) => {
  const newKey = enc.Utf8.parse(MD5(password).toString());
  const newIv = enc.Utf8.parse(SHA256(password).toString());

  if (enc.Utf8.stringify(newKey) !== enc.Utf8.stringify(key)) return false;
  if (enc.Utf8.stringify(newIv) !== enc.Utf8.stringify(iv)) return false;
  return true;
};

/**
 * aes 加密
 */
export const aes = (
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
 * aes 解密
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
  const decryptedStr = decrypt.toString(enc.Utf8);
  return decryptedStr.toString();
};
