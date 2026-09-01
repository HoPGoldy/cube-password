import { atom, getDefaultStore } from "jotai";
import { localTheme } from "./lcoal";
import type { SchemaAuthLoginResponseType } from "@shared-types/auth";

export type AppTheme = "light" | "dark";

export interface UserInfo {
  theme: AppTheme;
  initTime: string;
  defaultGroupId: number;
  hasNotice: boolean;
  withTotp: boolean;
  createPwdAlphabet: string;
  createPwdLength: number;
}

export interface GroupInfo {
  id: number;
  name: string;
  lockType: string;
  unlocked: boolean;
  salt?: string;
}

/** session token (in-memory only, not persisted) */
export const stateSessionToken = atom(undefined as string | undefined);

/** replay attack secret */
export const stateReplayAttackSecret = atom(undefined as string | undefined);

/** user info */
export const stateUser = atom(undefined as UserInfo | undefined);

/** is logged in */
export const stateIsLoggedIn = atom<boolean>((get) => !!get(stateSessionToken));

/** group list */
export const stateGroupList = atom<GroupInfo[]>([]);

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
  store.set(stateSessionToken, undefined);
  store.set(stateReplayAttackSecret, undefined);
  store.set(stateUser, undefined);
  store.set(stateGroupList, []);
};

export const login = (payload: SchemaAuthLoginResponseType) => {
  const { token, replayAttackSecret, groups, salt, ...userInfo } = payload;
  const store = getDefaultStore();

  store.set(stateSessionToken, token);
  store.set(stateReplayAttackSecret, replayAttackSecret);
  store.set(stateKdfMeta, { salt, kdfParamsRaw: payload.kdfParams });
  store.set(stateUser, {
    ...userInfo,
    theme: (userInfo.theme as AppTheme) || "light",
  });
  store.set(
    stateGroupList,
    groups.map((g) => ({
      ...g,
      unlocked: g.lockType === "None",
      salt: g.salt,
    })),
  );

  localTheme.set(userInfo.theme || "light");
};

export const changeTheme = (theme: AppTheme) => {
  const store = getDefaultStore();
  const userInfo = store.get(stateUser);
  if (!userInfo) return;
  store.set(stateUser, { ...userInfo, theme });
  localTheme.set(theme);
};
