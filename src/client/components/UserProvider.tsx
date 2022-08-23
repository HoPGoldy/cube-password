import { MyJwtPayload } from '@/types/global'
import { CertificateGroupDetail, CertificateListItem, NoticeInfoResp } from '@/types/http'
import React, { Dispatch, FC, SetStateAction, useContext, useMemo, useState } from 'react'
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
     * 通知信息
     */
    noticeInfo: NoticeInfoResp | undefined
    setNoticeInfo: Dispatch<SetStateAction<NoticeInfoResp | undefined>>

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
    const [noticeInfo, setNoticeInfo] = useState<NoticeInfoResp>()
    const [groupList, setGroupList] = useState<CertificateGroupDetail[]>([])
    const [selectedGroup, setSelectedGroup] = useState<number>(0)
    const {
        data: certificateList,
        refetch: refetchCertificateList,
        isLoading: certificateListLoading
    } = useGroupCertificates(selectedGroup)

    const refetchGroupList = async () => {
        const resp = await getGroupList()
        setGroupList(resp)
    }

    const value = {
        userProfile, setUserProfile,
        noticeInfo, setNoticeInfo,
        groupList, setGroupList,
        selectedGroup, setSelectedGroup, refetchGroupList,
        certificateList, refetchCertificateList,
        certificateListLoading
    }

    return (
        <UserContext.Provider value={value}>
            {props.children}
        </UserContext.Provider>
    )
}

export const useJwtPayload = () => {
    const { userProfile } = useContext(UserContext)
    const payload = useMemo<MyJwtPayload>(() => {
        if (!userProfile || !userProfile.token) {
            return undefined
        }

        return JSON.parse(decodeURIComponent(escape(window.atob(userProfile.token.split('.')[1]))))
    }, [userProfile])

    return payload
}

/**
 * 判断一个分组是否登录
 * @param payload jwt 的载荷信息
 * @param groupId 要判断的分组 id
 */
export const hasGroupLogin = (payload: MyJwtPayload, groupId: number) => {
    if (!payload.groups) return false
    return payload.groups.includes(groupId)
}