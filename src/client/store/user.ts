import { AppTheme, FrontendUserInfo, LoginSuccessResp } from '@/types/user';
import { atom, getDefaultStore } from 'jotai';
import { rebuildGroup, stateGroupList } from './group';

/**
 * 从用户信息中获取主题色
 * 在用户信息没有获取到时，从 localStorage 和默认值获取
 */
export const getUserTheme = (userTheme?: AppTheme): AppTheme => {
  return userTheme || (localStorage.getItem('cube-password-theme') as AppTheme) || AppTheme.Light;
};

/**
 * 当前登录用户状态
 */
export const stateUser = atom<Omit<FrontendUserInfo, 'groups'> | undefined>(undefined);

/**
 * 当前用户的防重放攻击密钥
 * 登录后设置
 */
export const stateReplayAttackSecret = atom<string | undefined>(undefined);

/**
 * 当前用户的登录 token
 */
export const stateUserToken = atom<string | undefined>(undefined);

export const logout = () => {
  const store = getDefaultStore();

  store.set(stateUser, undefined);
  store.set(stateReplayAttackSecret, undefined);
  store.set(stateUserToken, undefined);
};

export const login = (payload: LoginSuccessResp) => {
  const { token, replayAttackSecret, groups, ...userInfo } = payload;
  const store = getDefaultStore();

  store.set(stateUser, userInfo);
  store.set(stateReplayAttackSecret, replayAttackSecret);
  store.set(stateUserToken, token);
  store.set(stateGroupList, groups?.map(rebuildGroup) || []);
};

export const changeTheme = (theme: AppTheme) => {
  const store = getDefaultStore();
  const userInfo = store.get(stateUser);

  if (!userInfo) return;
  store.set(stateUser, { ...userInfo, theme });
  localStorage.setItem('cube-password-theme', theme);
};

interface MainPwdState {
  /**
   * 主密码 aes key
   */
  pwdKey?: CryptoJS.lib.WordArray;
  /**
   * 主密码 aes 初始向量
   */
  pwdIv?: CryptoJS.lib.WordArray;
}

export const stateMainPwd = atom<MainPwdState>({ pwdKey: undefined, pwdIv: undefined });
