/**
 * 分组信息
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