import { useMutation, useQuery } from 'react-query'
import { CertificateGroup } from '@/types/app'
import { AddGroupResp, CertificateListItem } from '@/types/http'
import { sendGet, sendPost, sendPut, sendDelete } from './base'
import { Notify } from 'react-vant'
import { queryClient } from '../components/QueryClientProvider'

/**
 * 获取指定分组的下属凭证
 */
export const getGroupCertificates = async (groupId: number) => {
    return sendGet<CertificateListItem[]>(`/group/${groupId}/certificates`)
}

export const useGroupCertificates = (groupId: number) => {
    return useQuery(['group', groupId, 'certificates'], () => getGroupCertificates(groupId), {
        enabled: !!groupId,
    })
}

/**
 * 新增分组
 */
export const addGroup = async (detail: CertificateGroup) => {
    return sendPost<AddGroupResp>('/addGroup', detail)
}

/**
 * 更新分组
 */
export const updateGroup = async (id: number, detail: CertificateGroup) => {
    return sendPut<CertificateGroup>(`/group/${id}`, detail)
}

/**
 * 删除指定分组
 */
export const deleteGroup = async (id: number) => {
    return sendDelete<number>(`/group/${id}`)
}

export const useDeleteGroup = (onSuccess: (nextDefaultGroupId: number) => unknown) => {
    return useMutation(deleteGroup, {
        onSuccess: data => {
            if (data.code !== 200 || !data.data) {
                Notify.show({ type: 'danger', message: data.msg })
                return
            }

            Notify.show({ type: 'success', message: '删除成功' })
            onSuccess(data.data)
        }
    })
}
