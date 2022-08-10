import { HttpRequestLog } from './app'

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
}

/**
 * 凭证详情接口返回值
 */
export interface CertificateDetailResp<T = string> {
    name: string
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
export interface LoginResp {
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
 * 日志查询筛选器
 */
export interface LogSearchFilter {
    pageIndex: number
    pageSize: number
    routes?: string
}

/**
 * 日志查询响应
 */
export interface LogListResp {
    entries: Exclude<HttpRequestLog, 'date'>[]
    total: number
}