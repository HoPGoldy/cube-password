import { useMutation, useQuery } from 'react-query'
import { requestGet, requestPost } from './base'
import { CertificateAddReqBody, CertificateDetailResp, CertificateUpdateReqBody } from '@/types/certificate'

/**
 * 获取随机英文名
 */
export const getRandName = async () => {
    return await requestGet<string>('certificate/randName')
}

/**
 * 获取凭证详情
 */
export const useCertificateDetail = (id: number) => {
    return useQuery(['certificate', id], () => requestGet<CertificateDetailResp>(`certificate/${id}`))
}

/**
 * 保存凭证
 */
export const useSaveCertificate = (id: number | undefined) => {
    return useMutation(async (data: CertificateAddReqBody) => {
        if (id === -1) {
            return await requestPost<CertificateDetailResp>('certificate/add', { data })
        }

        return await requestPost<CertificateUpdateReqBody>('certificate/updateDetail', { data: { ...data, id } })
    })
}
