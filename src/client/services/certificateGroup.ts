import { CertificateGroup } from '@/types/app'
import { AddGroupResp, CertificateListItem, FirstScreenResp } from '@/types/http'
import { sendGet, sendPost, sendPut, sendDelete } from './base'

/**
 * 获取首屏显示数据
 */
export const getFirstScreen = async () => {
    return sendGet<FirstScreenResp>('/firstScreen')
}

/**
 * 获取指定分组的下属凭证
 */
export const getGroupCertificates = async (groupId: number) => {
    return sendGet<CertificateListItem[]>(`/group/${groupId}/certificates`)
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