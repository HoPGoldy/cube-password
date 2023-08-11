export enum SecurityNoticeType {
  Info = 1,
  Warning,
  Danger,
}

export interface SecurityNotice {
  /**
   * 通知标题
   */
  title: string;
  /**
   * 具体描述，支持 HTML
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

export interface LoginFailRecord {
  /** 登录时间 */
  date: number;
  /** 登录 ip */
  ip: string;
  /** ip 定位 */
  location: string;
}
