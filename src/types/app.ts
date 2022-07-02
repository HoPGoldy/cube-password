/**
 * 凭证分组信息
 */
export interface CertificateGroup {
    /**
     * 分组名称
     */
    name: string
    /**
     * 分组密码 sha512 摘要
     */
    passwordSha?: string
    /**
     * 分组密码盐值
     */
    passwordSalt?: string
}

/**
 * 凭证机密字段
 */
export interface CertificateField {
    /**
     * 字段名
     */
    label: string
    /**
     * 字段值
     */
    value: string
}

/**
 * 凭证详情
 */
export interface CertificateDetail {
    /**
     * 凭证名称
     */
    name: string
    /**
     * 凭证所属分组 id
     */
    groupId: string
    /**
     * 凭证的加密内容（解密后为凭证字段数组）
     */
    content: string
}

/**
 * 应用全局信息
 */
export interface AppStorage {
    /**
     * 主密码 sha512 摘要
     */
    passwordSha?: string
    /**
     * 主密码盐值
     */
    passwordSalt?: string
    /**
     * 主题色
     */
    theme: AppTheme
}

/**
 * 应用主题色
 */
export enum AppTheme {
    Dark = 'dark',
    Light = 'light'
}

/**
 * 登录日志
 */
export interface LoginLog {
    /**
     * 请求登录的 ip
     */
    ip: string
    /**
     * 请求登录的时间
     */
    requestDate: number
    /**
     * 是否通过登录
     */
    pass: boolean
}

/**
 * 凭证查看日志
 */
export interface DetailCheckLog {
    /**
     * 请求查看的 ip
     */
    ip: string
    /**
     * 请求的时间
     */
    requestDate: number
    /**
     * 查看的凭证名称
     */
    certificateName: string
}