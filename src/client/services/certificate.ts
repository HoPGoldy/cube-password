import { CertificateDetail, CertificateField, CertificateGroup } from '@/types/app'
import { AppResponse } from '@/types/global'
import { AddGroupResp, CertificateDetailResp, FirstScreenResp } from '@/types/http'
import { aes, aesDecrypt } from '@/utils/common'
import { sendGet, sendPost, sendPut, sendDelete } from './base'

/**
 * 新增凭证
 */
export const addCertificate = async (name: string, groupId: number, fields: CertificateField[], password: string) => {
    const content = aes(JSON.stringify(fields), password)
    return sendPost('/certificate', { name, groupId, content })
}

type CertificateFrontendDetail = AppResponse<CertificateDetailResp<CertificateField[]>>

/**
 * 获取凭证详情
 * 内部会对后端传来的加密凭证进行解密
 */
export const getCertificate = async (id: number, password: string): Promise<CertificateFrontendDetail> => {
    const resp = await sendGet<CertificateDetailResp>(`/certificate/${id}`)
    if (resp.code !== 200 || !resp.data) return resp as CertificateFrontendDetail

    try {
        const content = JSON.parse(aesDecrypt(resp.data.content, password))
        resp.data.content = content
    }
    catch (e) {
        console.error('凭证解密失败', e)
        resp.code = 400
        resp.msg = '凭证解密失败，请联系管理员'
    }

    return resp as CertificateFrontendDetail
}

export const updateCertificate = async (id: number, data: Partial<CertificateDetail>) => {
    return sendPut(`/certificate/${id}`, data)
}
