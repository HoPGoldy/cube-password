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
     * 凭证最后更新时间
     */
    updateTime: number
    /**
     * 凭证的加密内容（解密后为凭证字段数组）
     */
    content: string
}