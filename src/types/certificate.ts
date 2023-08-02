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
export interface CertificateStorage {
    id: number
    /**
     * 凭证名称
     */
    name: string
    /**
     * 该凭证在所属分组中的排序
     * 值越小，排序越靠前
     */
    order?: number
    /**
     * 圆点标记的颜色，默认为空（不显示原点标记）
     */
    markColor?: string
    /**
     * 凭证所属分组 id
     */
    groupId: number
    /**
     * 凭证创建时间
     */
    createTime: number
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
 * 新增凭证请求数据
 */
export interface CertificateAddReqBody {
    name: string
    markColor?: string
    groupId: number
    content: string
    order: number
}

/**
 * 更新凭证请求数据
 */
export type CertificateUpdateReqBody = CertificateAddReqBody & {
    id: number
}