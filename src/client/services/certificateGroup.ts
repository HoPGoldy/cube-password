import { useQuery } from 'react-query'
import { CertificateGroup } from '@/types/app'
import { AddGroupResp, CertificateListItem } from '@/types/http'
import { sendGet, sendPost, sendPut, sendDelete } from './base'

/**
 * 获取指定分组的下属凭证
 */
export const getGroupCertificates = async (groupId: number) => {
    console.log('正在请求', groupId)
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
export const deleteGroup = async (id: string) => {
    return sendDelete(`/group/${id}`)
}

/**
 * 把一个分组下的凭证全部转移到另一个分组
 */
export const moveCertificates = async (groupId: number, toGroupId: number) => {
    return sendPut('/group/moveAll/', { groupId, toGroupId })
}