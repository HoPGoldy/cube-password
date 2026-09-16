import { atom, getDefaultStore } from "jotai";
import { localTheme } from "./local";
import { clearCertNameIndex } from "./state-cert-name-index";
import { queryClient } from "../services/base";
import type { SchemaAuthLoginResponseType } from "@shared-types/auth";

export type AppTheme = "light" | "dark";

export interface UserInfo {
  theme: AppTheme;
  defaultGroupId: number;
  withTotp: boolean;
  createPwdAlphabet: string;
  createPwdLength: number;
  /** 凭证名称加密迁移标志：1=明文（需迁移），2=已加密（nameEnc） */
  metadataVersion: number;
}

/** session token (in-memory only, not persisted) */
export const stateSessionToken = atom(undefined as string | undefined);

/**
 * 会话绝对过期时刻（来自 login 响应的 ISO 字符串）
 * - 服务端绝对超时不续期；倒计时与到期登出均以该值为准
 */
export const stateSessionExpiresAt = atom(undefined as string | undefined);

/** user info */
export const stateUser = atom(undefined as UserInfo | undefined);

/** is logged in */
export const stateIsLoggedIn = atom<boolean>((get) => !!get(stateSessionToken));

/**
 * 已解锁（无锁或已通过密码/验证码解锁）的分组 id 集合（client state）
 * - 分组服务端数据（名称/锁类型等）由 react-query 的 groupList 管理，不在此处
 * - lockType === "None" 的组登录时加入；unlock 成功加入；登出清空
 */
export const stateUnlockedGroupIds = atom<Set<number>>(new Set<number>());

/**
 * 登录前 KDF 元数据（登录成功后以 login 响应为准写入 stateVault）
 * - salt：hex(KDF salt)
 * - kdfParamsRaw：后端下发的 kdfParams JSON 原文，派生前经 parseKdfParams 校验
 */
export interface KdfMeta {
  salt?: string;
  kdfParamsRaw?: string;
}

export const stateKdfMeta = atom<KdfMeta>({});

/**
 * 内存中的密钥材料（永不进 localStorage / IndexedDB / cookie）
 * - dek：全局数据加密密钥，用于凭证 content 加解密
 * - kek：登录派生，解开 keyBlob 后即可丢弃（改密码只需 DEK + 新 KEK）
 * - keyBlob / salt / kdfParams：改密码时本地验旧密码与 re-wrap 所需
 */
export interface VaultState {
  dek?: Uint8Array;
  kek?: Uint8Array;
  keyBlob?: string;
  salt?: string;
  kdfParams?: import("@/lib/e2ee").KdfParams;
}

export const stateVault = atom<VaultState>({});

/**
 * 清空密钥材料（先覆写内存再置空，防止密钥残留在已释放内存中）
 */
export const clearVault = (vault?: VaultState) => {
  vault?.dek?.fill(0);
  vault?.kek?.fill(0);
  return { dek: undefined, kek: undefined };
};

export const logout = () => {
  const store = getDefaultStore();
  store.set(stateVault, (prev) => clearVault(prev));
  // 明文名称索引与 DEK 同生命周期：先于会话状态清空，防止下一个账号读到上一个账号的数据
  clearCertNameIndex();
  store.set(stateSessionToken, undefined);
  store.set(stateSessionExpiresAt, undefined);
  store.set(stateUser, undefined);
  store.set(stateUnlockedGroupIds, new Set());
  // react-query 缓存不在登出时清：此刻组件树尚未卸载，clear 会让还挂着的
  // observer（Sidebar 的 group/list、AppContainer 的 config/version 等）立即
  // refetch，发出登出后的幽灵请求。清缓存移至登录页挂载时（组件已全卸载）
};

export const login = (payload: SchemaAuthLoginResponseType) => {
  const { token, groups, salt, ...userInfo } = payload;
  const store = getDefaultStore();

  store.set(stateSessionToken, token);
  store.set(stateSessionExpiresAt, payload.expiresAt);
  store.set(stateKdfMeta, { salt, kdfParamsRaw: payload.kdfParams });
  store.set(stateUser, {
    ...userInfo,
    theme: (userInfo.theme as AppTheme) || "light",
  });
  // 无锁分组登录即解锁
  store.set(
    stateUnlockedGroupIds,
    new Set(groups.filter((g) => g.lockType === "None").map((g) => g.id)),
  );

  // 分组服务端数据改由 react-query 管理，登录后拉取最新列表
  queryClient.invalidateQueries({ queryKey: ["groupList"] });

  localTheme.set(userInfo.theme || "light");
};

export const changeTheme = (theme: AppTheme) => {
  const store = getDefaultStore();
  const userInfo = store.get(stateUser);
  if (!userInfo) return;
  store.set(stateUser, { ...userInfo, theme });
  localTheme.set(theme);
};
