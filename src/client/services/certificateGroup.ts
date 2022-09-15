import { CertificateGroup } from '@/types/app'
import { AddGroupResp, CertificateGroupDetail, CertificateListItem, GroupAddPasswordData, RequireLoginResp } from '@/types/http'
import { sendGet, sendPost, sendPut, sendDelete } from './base'
import { sha } from '@/utils/crypto'
import { nanoid } from 'nanoid'

/**
 * 请求重要操作的挑战码
 */
export const requireOperate = async (groupId: number) => {
    return sendPost<RequireLoginResp>(`/group/requireOperate/${groupId}`)
}

/**
 * 解锁分组
 */
export const unlockGroup = async (groupId: number, password: string, salt: string, challenge: string) => {
    return sendPost<{ token: string }>(`/group/unlock/${groupId}`, {
        code: sha(sha(salt + password) + challenge)
    })
}

/**
 * 获取分组列表
 */
export const getGroupList = async () => {
    return sendGet<CertificateGroupDetail[]>('/group')
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
export const updateGroupName = async (id: number, name: string) => {
    return sendPut<CertificateGroup>(`/updateGroupName/${id}`, { name })
}

/**
 * 删除指定分组
 */
export const deleteGroup = async (id: number) => {
    return sendDelete<number>(`/group/${id}`)
}

/**
 * 更新分组排序
 */
export const updateGroupSort = async (groupIds: number[]) => {
    return sendPut('/updateGroupSort', { groupIds })
}

/**
 * 设置默认分组
 */
export const setDefaultGroup = async (groupId: number) => {
    return sendPut('/setDefaultGroup', { groupId })
}

/**
 * 分组添加密码
 */
export const groupAddPassword = async (groupId: number, password: string) => {
    const salt = nanoid(128)
    const data: GroupAddPasswordData = { hash: sha(salt + password), salt }
    return sendPost<CertificateGroupDetail[]>(`/group/addPassword/${groupId}`, data)
}

/**
 * 分组移除密码
 */
export const groupRemovePassword = async (groupId: number, hash: string, code?: string) => {
    return sendPost<CertificateGroupDetail[]>(`/group/removePassword/${groupId}`, { hash, code })
}
