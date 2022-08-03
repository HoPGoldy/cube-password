
import { CertificateDetailResp, CertificateMoveReqBody } from '@/types/http'
import { useMutation, useQuery } from 'react-query'
import { Notify } from 'react-vant'
import { queryClient } from '../components/QueryClientProvider'
import { sendGet, sendPost, sendPut } from './base'

/**
 * 获取凭证详情
 * 内部会对后端传来的加密凭证进行解密
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
            if (data.resp.code !== 200) {
                Notify.show({ type: 'danger', message: data.resp.msg })
                return
            }

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
        onSuccess: data => {
            if (data.code !== 200) {
                Notify.show({ type: 'danger', message: data.msg })
                return
            }

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
        onSuccess: data => {
            if (data.code !== 200) {
                Notify.show({ type: 'danger', message: data.msg })
                return
            }

            Notify.show({ type: 'success', message: '移动成功' })
            queryClient.fetchQuery(['group', groupId, 'certificates'])
        }
    })
}
