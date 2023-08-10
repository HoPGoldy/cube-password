import { useMutation, useQuery } from 'react-query'
import { queryClient, requestGet, requestPost } from './base'
import { CertificateAddReqBody, CertificateDetailResp, CertificateMoveReqBody, CertificateUpdateReqBody } from '@/types/certificate'
import { CertificateListItem } from '@/types/group'

/**
 * 获取随机英文名
 */
export const getRandName = async () => {
    return await requestGet<string>('certificate/randName')
}

/**
 * 获取凭证详情
 */
export const useCertificateDetail = (id: number | undefined) => {
    return useQuery(
        ['certificateDetail', id],
        () => requestGet<CertificateDetailResp>(`certificate/${id}/getDetail`),
        { enabled: !!id && id !== -1 }
    )
}

/**
 * 保存凭证
 */
export const useSaveCertificate = (id: number | undefined) => {
    return useMutation(
        async (data: CertificateAddReqBody) => {
            if (id === -1) {
                return await requestPost<CertificateDetailResp>('certificate/add', data)
            }

            return await requestPost<CertificateUpdateReqBody>('certificate/updateDetail', { ...data, id })
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries('certificateList')
            }
        }
    )
}

/**
 * 获取分组下属凭证列表
 */
export const useCertificateList = (groupId: number | undefined, groupUnlocked: boolean) => {
    return useQuery(
        ['certificateList', groupId],
        () => requestGet<CertificateListItem[]>(`group/${groupId}/certificates`),
        { enabled: !!groupId && groupUnlocked }
    )
}

/**
 * 移动凭证
 */
export const useMoveCertificate = () => {
    return useMutation(
        async (data: CertificateMoveReqBody) => {
            return await requestPost('certificate/move', data)
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries('certificateList')
            }
        }
    )
}