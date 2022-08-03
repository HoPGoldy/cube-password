import { CertificateGroupDetail, CertificateListItem } from '@/types/http'
import React, { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import { Notify } from 'react-vant'
import { getGroupList, useGroupCertificates } from '../services/certificateGroup'

export interface UserProfile {
    token: string
    password: string
    defaultGroupId: number
}

interface Context {
    /**
     * 用户信息
     */
    userProfile: UserProfile | undefined
    setUserProfile: Dispatch<SetStateAction<UserProfile | undefined>>

    /**
     * 用户所有的分组列表
     */
    groupList: CertificateGroupDetail[]
    setGroupList: Dispatch<SetStateAction<CertificateGroupDetail[]>>
    refetchGroupList: () => Promise<unknown>

    /**
     * 当前选中的分组
     */
    selectedGroup: number
    setSelectedGroup: Dispatch<SetStateAction<number>>

    /**
     * 当前选中分组的下属凭证列表
     */
    certificateList: CertificateListItem[] | undefined
    setCertificateList: Dispatch<SetStateAction<CertificateListItem[] | undefined>>
    refetchCertificateList: () => Promise<unknown>
    /**
     * 当前选中分组是否加载中
     */
    certificateListLoading: boolean
}

export const UserContext = React.createContext<Context>({} as Context)

/**
 * 提供用户的全局信息
 */
export const UserProvider: FC = (props) => {
    const [userProfile, setUserProfile] = useState<UserProfile>()
    const [groupList, setGroupList] = useState<CertificateGroupDetail[]>([])
    const [selectedGroup, setSelectedGroup] = useState<number>(0)
    const [certificateList, setCertificateList] = useState<CertificateListItem[] | undefined>([])
    const {
        data: certificateListResp,
        refetch: refetchCertificateList,
        isLoading: certificateListLoading
    } = useGroupCertificates(selectedGroup)

    useEffect(() => {
        if (selectedGroup === 0 || certificateListLoading) return
        if (certificateListResp?.code !== 200 || !certificateListResp.data) {
            Notify.show({ message: '获取凭证列表失败', type: 'danger' })
            return
        }

        setCertificateList(certificateListResp.data)
    }, [certificateListResp])

    const refetchGroupList = async () => {
        const resp = await getGroupList()
        if (resp.code !== 200 || !resp.data) {
            Notify.show({ message: '获取凭证列表失败', type: 'danger' })
            return
        }

        setGroupList(resp.data)
    }

    const value = {
        userProfile, setUserProfile,
        groupList, setGroupList,
        selectedGroup, setSelectedGroup,
        certificateList, setCertificateList,
        refetchCertificateList, refetchGroupList,
        certificateListLoading
    }

    return (
        <UserContext.Provider value={value}>
            {props.children}
        </UserContext.Provider>
    )
}