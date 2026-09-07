import { atom, getDefaultStore } from "jotai";

/** 解密失败条目的名称占位符（单条密文损坏不阻塞整体索引） */
export const NAME_DECRYPT_FAILED = "解密失败";

/** 索引条目的非密文元数据（接口明文下发，仅内存保存） */
export interface CertIndexMeta {
  icon: string | null;
  markColor: string | null;
  updatedAt: string;
  groupId: number;
}

/**
 * 内存明文名称索引（元数据加密：服务端只存 nameEnc 密文）
 * - Map<凭证 id, 解密后的明文名称>
 * - 由 queryCertificateIndex 登录后拉全量索引并用 DEK 批量解密构建
 * - 与 DEK 同生命周期：logout 清空（见 store/user.ts 的 logout 清理链）
 */
export const stateCertNameIndex = atom<Map<number, string>>(new Map());

/** 索引条目的元数据（icon/markColor/updatedAt/groupId，供搜索过滤与跳转） */
export const stateCertMetaIndex = atom<Map<number, CertIndexMeta>>(new Map());

/**
 * 整体替换内存索引（索引构建/重建时使用）
 */
export const setCertNameIndex = (
  names: Map<number, string>,
  metas: Map<number, CertIndexMeta>,
) => {
  const store = getDefaultStore();
  store.set(stateCertNameIndex, names);
  store.set(stateCertMetaIndex, metas);
};

/**
 * 清空内存索引（logout 时调用，与 DEK 清理同链路）
 */
export const clearCertNameIndex = () => {
  const store = getDefaultStore();
  store.set(stateCertNameIndex, new Map());
  store.set(stateCertMetaIndex, new Map());
};

/** 读取单个凭证的明文名称（索引未命中时显示占位符） */
export const getCertName = (id: number): string => {
  const index = getDefaultStore().get(stateCertNameIndex);
  return index.get(id) ?? NAME_DECRYPT_FAILED;
};
