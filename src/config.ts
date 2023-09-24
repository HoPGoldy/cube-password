import { AppConfig } from './types/appConfig';

/**
 * 接口返回的状态码
 */
export const STATUS_CODE = {
  SUCCESS: 200,
  NOT_REGISTER: 40101,
  ALREADY_REGISTER: 40102,
  /**
   * 用户被封禁
   */
  BAN: 40103,
  /**
   * 因为关联了其他资源所以无法删除
   */
  CANT_DELETE: 40601,
  /**
   * 未提供防重放攻击 header
   */
  REPLAY_ATTACK: 40602,
  /**
   * 分组未验证密码
   */
  GROUP_NOT_VERIFY_PASSWORD: 40103,
  /**
   * 分组密码错误
   */
  GROUP_PASSWORD_ERROR: 40104,
  /**
   * 需要提供动态验证码
   */
  NEED_CODE: 40105,
  /**
   * 登录密码错误
   */
  LOGIN_PASSWORD_ERROR: 40106,
  /**
   * 登录超时
   */
  LOGIN_TIMEOUT: 40107,
} as const;

/**
 * 统一的日期格式化
 */
export const DATE_FORMATTER = 'YYYY-MM-DD HH:mm:ss';

/**
 * 无需登录即可访问的接口
 */
export const AUTH_EXCLUDE = [
  '/api/global',
  '/api/challenge',
  '/api/user/login',
  '/api/user/createAdmin',
];

/**
 * 默认（默认分组）的标签分组 ID
 */
export const DEFAULT_TAG_GROUP = -1;

/**
 * 固定分页条数
 */
export const PAGE_SIZE = 15;

/**
 * 数据库表名
 */
export const TABLE_NAME = {
  /** 用户表 */
  USER: 'users',
  /** 凭证表 */
  CERTIFICATE: 'certificates',
  /** 分组表 */
  GROUP: 'groups',
  /** 通知表 */
  NOTIFICATION: 'notifications',
} as const;

/**
 * 密码生成的默认字符集
 */
export const DEFAULT_PASSWORD_ALPHABET =
  '-=_+[]{}();/:",.<>?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 密码生成的默认长度
 */
export const DEFAULT_PASSWORD_LENGTH = 18;

/**
 * 默认的应用配置项
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  DEFAULT_COLOR: [
    {
      primaryColor: '#0081ff',
      buttonColor: 'linear-gradient(45deg, #0081ff, #1cbbb4)',
    },
    {
      primaryColor: '#9000ff',
      buttonColor: 'linear-gradient(45deg, #9000ff, #5e00ff)',
    },
    {
      primaryColor: '#ec008c',
      buttonColor: 'linear-gradient(45deg, #ec008c, #6739b6)',
    },
    {
      primaryColor: '#39b54a',
      buttonColor: 'linear-gradient(45deg, #39b54a, #8dc63f)',
    },
    {
      primaryColor: '#ff9700',
      buttonColor: 'linear-gradient(45deg, #ff9700, #ed1c24)',
    },
    {
      primaryColor: '#f43f3b',
      buttonColor: 'linear-gradient(45deg, #f43f3b, #ec008c)',
    },
  ],
  APP_NAME: '方块密码',
  LOGIN_SUBTITLE: '🔒 保存你的密码',
  LOGIN_MAX_RETRY_COUNT: 3,
};
