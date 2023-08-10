/**
 * 凭证分组信息
 */
export interface CertificateGroupStorage {
    /** 分组 id */
    id: number
    /** 分组名称 */
    name: string
    /** 分组排序顺序 */
    order?: number
    /** 是否使用 TOTP 密码 */
    useTotp?: boolean
    /** 分组密码 sha512 摘要 */
    passwordHash?: string
    /** 分组密码盐值 */
    passwordSalt?: string
}

/**
 * 分组信息
 */
export interface CertificateGroupDetail {
    /** 分组 id */
    id: number
    /** 分组名 */
    name: string
    /** 分组是否需要密码 */
    requireLogin: boolean
    /** 是否使用 otp 登录 */
    useTotp?: boolean
    /** 盐值，如果需要密码登录就会有这个值 */
    salt?: string
}

export interface AddGroupResp {
    /** 完整的分组列表 */
    newList: CertificateGroupDetail[]
    /** 新的分组 id */
    newId: number
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
    id: number
    /**
     * 凭证名称
     */
    name: string
    /**
     * 最近更新时间
     */
    updateTime: string
    /**
     * 标记颜色
     */
    markColor?: string
}

/**
 * 前端发送给后端的分组添加密码数据
 */
export interface GroupAddPasswordData {
    /**
     * 密码的 hash 值
     */
    a: string
    /**
     * 密码盐值
     */
    b: string
}

/**
 * 前端发送给后端的分组密码移除数据
 */
export interface GroupRemovePasswordData {
    /**
     * 分组密码 hash
     */
    a: string
    /**
     * 动态验证码
     * 绑定了令牌的话这个就会有值
     */
    b?: string
}

/** 分组加密类型 */
export enum LockType {
    /** 不加密 */
    None = 'None',
    /** 使用密码加密 */
    Password = 'Password',
    /** 使用 totp 加密 */
    Totp = 'Totp'
}