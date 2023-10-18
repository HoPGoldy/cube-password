export enum SecurityNoticeType {
  Info = 1,
  Warning,
  Danger,
}

export interface SecurityNoticeStorage {
  /**
   * 通知标题
   */
  title: string;
  /**
   * 具体描述
   */
  content: string;
  /**
   * 通知发布时间
   */
  date: number;
  /**
   * 通知严重程度
   */
  type: SecurityNoticeType;
  /**
   * 用户是否已读
   */
  isRead: boolean;
}

export interface SecurityNoticeRecord extends SecurityNoticeStorage {
  id: number;
}

export interface LoginFailRecord {
  /** 登录时间 */
  date: number;
  /** 登录 ip */
  ip: string;
  /** ip 定位 */
  location: string;
}

export interface LockDetail {
  /** 登录失败的日志 */
  loginFailure: LoginFailRecord[];
  /** 剩余重试次数 */
  retryNumber: number;
  /** 登录是否被锁定 */
  isBanned: boolean;
}
