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
}

export interface AddGroupResp {
    /** 完整的分组列表 */
    newList: CertificateGroupDetail[]
    /** 新的分组 id */
    newId: number
}