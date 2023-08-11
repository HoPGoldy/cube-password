import { CertificateGroupDetail } from './group';

export interface UserStorage {
  id: number;
  /** 密码 sha512 摘要 */
  passwordHash: string;
  /** 密码的盐值 */
  passwordSalt: string;
  /** 默认展示的分组 */
  defaultGroupId: number;
  /** 上次登录所在地 */
  commonLocation?: string;
  /**
   * 谷歌一次性验证码密钥
   * 有值则代表已绑定
   */
  totpSecret?: string;
  /** 主题色 */
  theme: AppTheme;
  /** 初始化时间 */
  initTime: number;
  /**
   * 密码生成字符集
   * 没有就用默认值
   */
  createPwdAlphabet?: string;
  /**
   * 密码生成长度
   * 没有就用默认值
   */
  createPwdLength?: number;
}

/** 应用主题色 */
export enum AppTheme {
  Dark = 'dark',
  Light = 'light',
}

export interface RegisterReqData {
  code: string;
  salt: string;
}

export interface LoginReqData {
  /** 密码 */
  a: string;
  /** totp 验证码 */
  b?: string;
}

/** 登录接口返回值 */
export type LoginResp = Partial<LoginSuccessResp> & Partial<LoginFailResp>;

export type LoginSuccessResp = {
  /** 用户鉴权令牌 */
  token: string;
  /** 防重放攻击的签名密钥 */
  replayAttackSecret: string;
} & FrontendUserInfo;

export interface LoginFailResp {
  /** 登录错误的日期数组 */
  loginFailure: number[];
  /** 登录是否被锁定 */
  ipBaned: boolean;
}

export interface ChangePasswordReqData {
  newP: string;
  oldP: string;
}

export interface SetThemeReqData {
  theme: AppTheme;
}

export interface FrontendUserInfo {
  /** 主题色 */
  theme: AppTheme;
  /** 初始化时间 */
  initTime: number;
  /** 用户所有的分组信息 */
  groups: CertificateGroupDetail[];
  /** 默认展示的分组 */
  defaultGroupId: number;
  /** 是否有未读通知 */
  hasNotice: boolean;
  /** 密码生成字符集 */
  createPwdAlphabet: string;
  /** 密码生成长度 */
  createPwdLength: number;
}

/** 应用统计 */
export interface AppStatistics {
  /** 分组数量 */
  groupCount: number;
  /** 凭证数量 */
  certificateCount: number;
}
