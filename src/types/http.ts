import { CertificateDetail } from './app'

export interface RequireLoginResp {
    salt: string
    challenge: string
}

export interface FirstScreenResp {
    certificates: CertificateDetail[]
    groups: CertificateGroupDetail[]
    defaultGroupId: number
}

export interface CertificateGroupDetail {
    id: number
    name: string
    remark?: string
}