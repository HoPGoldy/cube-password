import { LockDetail } from './security';

/**
 * 后端发给前端的应用配置
 */
export interface AppConfigResp extends LockDetail {
  /** 主按钮颜色 */
  buttonColor: string;
  /** 项目主题色 */
  primaryColor: string;
  /** 应用名 */
  appName: string;
  /** 登录页副标题 */
  loginSubtitle: string;
  /** 是否已完成初始化 */
  needInit?: boolean;
  /** 主密码盐 */
  salt?: string;
}

export interface ColorConfig {
  /** 主题色 */
  primaryColor: string;
  /** 主按钮背景色 */
  buttonColor: string;
}

export interface AppConfig {
  DEFAULT_COLOR: Array<string | ColorConfig>;
  APP_NAME: string;
  LOGIN_SUBTITLE: string;
  /** 登录失败允许的最大重试次数 */
  LOGIN_MAX_RETRY_COUNT: number;
}
