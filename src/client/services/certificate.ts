import { useMutation, useQuery } from 'react-query'
import { requestGet, requestPost } from './base'
import { CertificateAddReqBody, CertificateDetailResp, CertificateUpdateReqBody } from '@/types/certificate'
import { CertificateGroupDetail } from '@/types/group'

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
            return await requestPost<CertificateDetailResp>('certificate/add', data)
        }

        return await requestPost<CertificateUpdateReqBody>('certificate/updateDetail', { ...data, id })
    })
}

/**
 * 获取分组下属凭证列表
 */
export const useCertificateList = (groupId: number | undefined) => {
    return useQuery(
        ['certificate', groupId],
        () => requestGet<CertificateGroupDetail[]>(`group/${groupId}/certificates`),
        { enabled: !!groupId }
    )
}