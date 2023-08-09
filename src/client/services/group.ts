import { useMutation, useQuery } from 'react-query'
import { requestGet, requestPost } from './base'
import { AddGroupResp, CertificateGroupStorage } from '@/types/group'
import { sha } from '@/utils/crypto'

/**
 * 新增分组
 */
export const useAddGroup = () => {
    return useMutation(
        async (data: Omit<CertificateGroupStorage, 'id'>) => {
            return await requestPost<AddGroupResp>('group/add', data)
        }
    )
}

/**
 * 解锁分组
 */
export const useUnlockGroup = (groupId: number) => {
    return useMutation(
        async (code: string) => {
            return await requestPost<boolean>(`group/${groupId}/unlock`, {
                code
            })
        }
    )
}