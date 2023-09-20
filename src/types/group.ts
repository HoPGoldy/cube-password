/** 分组加密类型 */
export enum LockType {
  /** 不加密 */
  None = 'None',
  /** 使用密码加密 */
  Password = 'Password',
  /** 使用 totp 加密 */
  Totp = 'Totp',
}

/**
 * 凭证分组信息
 */
export interface CertificateGroupStorage {
  /** 分组 id */
  id: number;
  /** 分组名称 */
  name: string;
  /** 分组排序顺序 */
  order?: number;
  /** 分组加密类型 */
  lockType: LockType;
  /** 分组密码 sha512 摘要 */
  passwordHash?: string;
  /** 分组密码盐值 */
  passwordSalt?: string;
}

/**
 * 分组信息
 */
export interface CertificateGroupDetail {
  /** 分组 id */
  id: number;
  /** 分组名 */
  name: string;
  /** 分组加密类型 */
  lockType: LockType;
  /** 盐值，如果需要密码登录就会有这个值 */
  salt?: string;
}

export interface AddGroupResp {
  /** 完整的分组列表 */
  newList: CertificateGroupDetail[];
  /** 新的分组 id */
  newId: number;
}

/**
 * 凭证列表页获取的凭证信息
 *
 * 这里是不包含凭证的具体内容的
 * 如果用户要查看的话，需要点击具体凭证后通过这里的 id 进行获取
 */
export interface CertificateListItem {
  /**
   * 凭证 id
   */
  id: number;
  /**
   * 凭证名称
   */
  name: string;
  /**
   * 最近更新时间
   */
  updateTime: string;
  /**
   * 标记颜色
   */
  markColor?: string;
  /**
   * 所在分组 id
   */
  groupId: number;
}

/**
 * 分组配置更新数据
 */
export interface GroupConfigUpdateData {
  /**
   * 加密类型
   */
  lockType: LockType;
  /**
   * 分组密码 hash
   */
  passwordHash?: string;
  /**
   * 分组密码盐值
   */
  passwordSalt?: string;
}
