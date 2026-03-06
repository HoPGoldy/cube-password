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
}

/** session token (in-memory only, not persisted) */
export const stateSessionToken = atom<string | undefined>(undefined);

/** replay attack secret */
export const stateReplayAttackSecret = atom<string | undefined>(undefined);

/** user info */
export const stateUser = atom<UserInfo | undefined>(undefined);

/** is logged in */
export const stateIsLoggedIn = atom<boolean>((get) => !!get(stateSessionToken));

/** group list */
export const stateGroupList = atom<GroupInfo[]>([]);

export const logout = () => {
  const store = getDefaultStore();
  store.set(stateSessionToken, undefined);
  store.set(stateReplayAttackSecret, undefined);
  store.set(stateUser, undefined);
  store.set(stateGroupList, []);
};

export const login = (payload: SchemaAuthLoginResponseType) => {
  const { token, replayAttackSecret, groups, ...userInfo } = payload;
  const store = getDefaultStore();

  store.set(stateSessionToken, token);
  store.set(stateReplayAttackSecret, replayAttackSecret);
  store.set(stateUser, {
    ...userInfo,
    theme: (userInfo.theme as AppTheme) || "light",
  });
  store.set(
    stateGroupList,
    groups.map((g) => ({
      ...g,
      unlocked: g.lockType === "None",
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

/** 主密码的 AES key/iv（用于前端加解密凭证内容） */
export const stateMainPwd = atom<{
  pwdKey?: CryptoJS.lib.WordArray;
  pwdIv?: CryptoJS.lib.WordArray;
}>({});
