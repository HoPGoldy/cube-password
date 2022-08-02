import React, { createContext, Dispatch, FC, SetStateAction, useState } from 'react'
import { CertificateGroupDetail, CertificateListItem } from '@/types/http'
import { Notify } from 'react-vant'
import { getGroupCertificates } from '../services/certificateGroup'

interface Context {
    groupList: CertificateGroupDetail[]
    setGroupList: Dispatch<SetStateAction<CertificateGroupDetail[]>>
    selectedGroup: number
    setSelectedGroup: Dispatch<SetStateAction<number>>
    certificateList: CertificateListItem[] | undefined
    setCertificateList: Dispatch<SetStateAction<CertificateListItem[] | undefined>>
    refetchCertificateList: () => Promise<void>
}

export const GroupContext = createContext<Context>({} as Context)

export const GroupProvider: FC = (props) => {
    const [groupList, setGroupList] = useState<CertificateGroupDetail[]>([])
    const [selectedGroup, setSelectedGroup] = useState<number>(0)
    const [certificateList, setCertificateList] = useState<CertificateListItem[] | undefined>([])

    const refetchCertificateList = async () => {
        setCertificateList(undefined)
        const resp = await getGroupCertificates(selectedGroup)
        if (resp.code !== 200 || !resp.data) {
            Notify.show({ message: '获取凭证列表失败', type: 'danger' })
            return
        }

        setCertificateList(resp.data)
    }

    const value = {
        groupList, setGroupList,
        selectedGroup, setSelectedGroup,
        certificateList, setCertificateList,
        refetchCertificateList
    }


    return (
        <GroupContext.Provider value={value}>
            {props.children}
        </GroupContext.Provider>
    )
}