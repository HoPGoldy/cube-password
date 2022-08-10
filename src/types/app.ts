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
    groupId: number
    /**
     * 凭证最后更新时间
     */
    updateTime: number
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
    /**
     * 上次登录所用 ip
     */
    commonIp?: string
    /**
     * 默认展示的分组 id
     */
    defaultGroupId: number
}

/**
 * 应用主题色
 */
export enum AppTheme {
    Dark = 'dark',
    Light = 'light'
}

/**
 * 接口请求日志
 */
export interface HttpRequestLog {
    id?: number
    /**
     * 发起请求的 ip
     */
    ip?: string
    /**
     * ip 的版本
     * 后端不存，前端通过 ip 自己解析
     */
    ipType?: 'ipv4' | 'ipv6'
    /**
     * ip 所在地
     * 使用 | 分割，未知的会填为 0，例如：中国|0|江苏省|苏州市|电信
     */
    location?: string
    /**
     * 这个接口的可读别名
     */
    name?: string
    /**
     * 请求日期毫秒时间戳
     */
    date: number | string
    /**
     * 请求方法，比如 GET
     */
    method: string
    /**
     * HTTP 响应状态码，比如 200
     */
    responseHttpStatus: number
    /**
     * 响应内部的应用状态码
     */
    responseStatus: number
    /**
     * 请求携带的 body 数据
     */
    requestBody: string
    /**
     * 请求携带的 url 参数
     */
    requestParams: string
    /**
     * 请求的接口路径
     */
    url: string
    /**
     * 请求的接口路由
     * 例如：/api/v1/certificates/:id
     */
    route: string
}
