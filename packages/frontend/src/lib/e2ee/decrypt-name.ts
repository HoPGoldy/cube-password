import { decryptContent } from "./cipher";

/** 解密失败条目的名称占位符（单条密文损坏不阻塞列表/索引） */
export const NAME_DECRYPT_FAILED = "解密失败";

/**
 * 解凭证名称：空密文返回空串，有密文则走 decryptContent（失败抛给调用方）
 */
export const decryptName = async (
  dek: Uint8Array,
  nameEnc: string,
): Promise<string> => {
  if (!nameEnc) return "";
  return decryptContent(dek, nameEnc);
};

/**
 * 列表 / 搜索索引用：缺 DEK、空密文、解密失败一律占位，不抛错
 */
export const decryptNameForList = async (
  dek: Uint8Array | undefined,
  nameEnc: string,
): Promise<string> => {
  if (!dek) return NAME_DECRYPT_FAILED;
  try {
    const name = await decryptName(dek, nameEnc);
    return name || NAME_DECRYPT_FAILED;
  } catch {
    return NAME_DECRYPT_FAILED;
  }
};
