
import { CertificateDetailResp, CertificateMoveReqBody } from '@/types/http'
import { useMutation, useQuery } from 'react-query'
import { Notify } from 'react-vant'
import { queryClient } from '../components/QueryClientProvider'
import { sendGet, sendPost, sendPut } from './base'

/**
 * 获取随机英文名
 */
export const getRandName = async () => {
    return await sendGet<string>('/randName')
}

/**
 * 获取凭证详情
 */
export const getCertificate = async (id: number | undefined) => {
    return await sendGet<CertificateDetailResp>(`/certificate/${id}`)
}

export const useCertificateDetail = (id: number | undefined) => {
    return useQuery(['certificate', id], () => getCertificate(id), {
        enabled: false,
    })
}

interface PostData {
    id?: number
    name: string
    markColor?: string
    groupId: number
    content: string
}

const updateCertificate = async (detail: PostData) => {
    // 新增凭证
    if (!detail.id) {
        const resp = await sendPost('/certificate', detail)
        return { resp, detail }
    }

    const data = { ...detail }
    delete data.id
    // 更新凭证
    const resp = await sendPut(`/certificate/${detail.id}`, data)

    return { resp, detail }
}

export const useUpdateCertificate = (onSuccess: () => void) => {
    return useMutation(updateCertificate, {
        onSuccess: data => {
            // 更新请求缓存
            if (data.detail.id) {
                queryClient.setQueryData(['certificate', data.detail.id], data.detail)
            }

            onSuccess()
        }
    })
}

const deleteCertificate = async (ids: number[]) => {
    return sendPut('/certificate/delete', { ids })
}

export const useDeleteCertificate = (groupId: number) => {
    return useMutation(deleteCertificate, {
        onSuccess: () => {
            Notify.show({ type: 'success', message: '删除成功' })
            queryClient.fetchQuery(['group', groupId, 'certificates'])
        }
    })
}

const moveCertificate = async (detail: CertificateMoveReqBody) => {
    return sendPut('/certificate/move', detail)
}

export const useMoveCertificate = (groupId: number) => {
    return useMutation(moveCertificate, {
        onSuccess: () => {
            Notify.show({ type: 'success', message: '移动成功' })
            queryClient.fetchQuery(['group', groupId, 'certificates'])
        }
    })
}

/**
 * 更新凭证排序
 */
export const updateCertificateSort = async (groupIds: number[]) => {
    return sendPut('/updateCertificateSort', { groupIds })
}