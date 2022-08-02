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
 * 应用进入首页后要获取的数据
 */
export interface FirstScreenResp {
    /**
     * 默认的分组 id
     */
    defaultGroupId: number
    /**
     * 默认分组的凭证列表
     */
    certificates: CertificateListItem[]
    /**
     * 所有的分组信息
     */
    groups: CertificateGroupDetail[]
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

export interface CertificateGroupDetail {
    id: number
    name: string
    remark?: string
}

export interface AddGroupResp {
    newList: CertificateGroupDetail[]
    newId: number
}
