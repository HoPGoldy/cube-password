import { AppTheme, HttpRequestLog, SecurityNoticeType } from './app'

export interface RequireLoginResp {
    salt: string
    challenge: string
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
 * 凭证详情接口返回值
 */
export interface CertificateDetailResp<T = string> {
    name: string
    markColor: string
    content: T
    createTime: string
    updateTime: string
}

/**
 * 分组的元数据
 */
export interface CertificateGroupDetail {
    /**
     * 分组 id
     */
    id: number
    /**
     * 分组名
     */
    name: string
    /**
     * 分组是否需要密码
     */
    requireLogin: boolean
}

export interface AddGroupResp {
    newList: CertificateGroupDetail[]
    newId: number
}

/**
 * 登录接口返回值
 */
export type LoginResp = {
    /**
     * 用户鉴权令牌
     */
    token: string
    /**
     * 用户所有的分组信息
     */
    groups: CertificateGroupDetail[]
    /**
     * 默认展示的分组
     */
    defaultGroupId: number
    /**
     * 是否有未读通知
     */
    hasNotice: boolean
    /**
     * 应用主题
     */
    theme: AppTheme
    /**
     * 防重放攻击的签名密钥
     */
    replayAttackSecret: string
    /**
     * 密码生成字符集
     */
    createPwdAlphabet: string
    /**
     * 密码生成长度
     */
    createPwdLength: number
} & NoticeInfoResp

export interface NoticeInfoResp {
    /**
     * 当前未读通知数量
     */
    unReadNoticeCount: number
    /**
     * 未读通知中的最高等级
     */
    unReadNoticeTopLevel: SecurityNoticeType
}

/**
 * 凭证移动请求数据
 */
export interface CertificateMoveReqBody {
    ids: number[]
    /**
     * 要移动到的新分组
     */
    newGroupId: number
}

/**
 * 带分页的查询条件
 */
export interface PageSearchFilter {
    /**
     * 要查询的分页
     */
    pageIndex: number
    /**
     * 每个分页的条数
     */
    pageSize: number
}

/**
 * 日志查询筛选器
 */
export type LogSearchFilter = PageSearchFilter & {
    routes?: string
}

export type NoticeSearchFilter = PageSearchFilter & {
    isRead?: boolean
}

/**
 * 日志查询响应
 */
export interface LogListResp {
    entries: Exclude<HttpRequestLog, 'date'>[]
    total: number
}

export interface NoticeListResp {
    entries: SecurityNoticeResp[]
    total: number
    /**
     * 当前未读通知里最危险的等级
     */
    topLevel?: SecurityNoticeType
    /**
     * 应用到现在已经运行了多少天
     */
    initTime: number
    /**
     * 总共审查了多少请求
     */
    totalScanReq: number
}

/**
 * 安全通知详情
 */
export interface SecurityNoticeResp {
    /**
     * 标题
     */
    title: string
    /**
     * 通知的内容
     */
    content: string
    /**
     * 通知发布时间
     */
    date: string
    /**
     * 通知索引
     */
    id: number
    /**
     * 是否已读
     */
    isRead?: boolean
    /**
     * 通知等级
     */
    type: SecurityNoticeType
}

export interface LoginErrorResp {
    /**
     * 登录错误的日期数组
     */
    loginFailure: string[]
    /**
     * 应用是否被锁定
     */
    appLock: boolean
    /**
     * 应用是被被无限期锁定
     */
    appFullLock: boolean
}

export interface CountInfoResp {
    group: number
    certificate: number
}

export interface ChangePasswordData {
    oldPwd: string
    newPwd: string
    /**
     * 动态验证码
     * 如果绑定了令牌的话这个就会有值
     */
    code?: string
}

export interface RegisterOTPInfo {
    /**
     * 是否已经注册
     */
    registered: boolean
    /**
     * 二维码 base64 编码
     * 未注册时才会显示
     */
    qrCode?: string
}

/**
 * 前端发送给后端的分组添加密码数据
 */
export interface GroupAddPasswordData {
    /**
     * 密码的 hash 值
     */
    hash: string
    /**
     * 密码盐值
     */
    salt: string
}

/**
 * 前端发送给后端的分组密码移除数据
 */
export interface GroupRemovePasswordData {
    /**
     * 分组密码 hash
     */
    hash: string
    /**
     * 动态验证码
     * 绑定了令牌的话这个就会有值
     */
    code?: string
}

/**
 * 新密码生成配置项
 */
export interface CreatePwdSettingData {
    /**
     * 字符集
     */
    pwdAlphabet: string
    /**
     * 密码长度
     */
    pwdLength: number
}