import React, { createContext, Dispatch, FC, SetStateAction, useState } from 'react'
import { CertificateDetail } from '@/types/app'
import { CertificateGroupDetail } from '@/types/http'

interface Context {
    groupList: CertificateGroupDetail[]
    setGroupList: Dispatch<SetStateAction<CertificateGroupDetail[]>>
    selectedGroup: number
    setSelectedGroup: Dispatch<SetStateAction<number>>
    certificateList: CertificateDetail[]
    setCertificateList: Dispatch<SetStateAction<CertificateDetail[]>>
}

export const GroupContext = createContext<Context>({} as Context)

export const GroupProvider: FC = (props) => {
    const [groupList, setGroupList] = useState<CertificateGroupDetail[]>([])
    const [selectedGroup, setSelectedGroup] = useState<number>(0)
    const [certificateList, setCertificateList] = useState<CertificateDetail[]>([])

    const value = {
        groupList, setGroupList,
        selectedGroup, setSelectedGroup,
        certificateList, setCertificateList
    }

    return (
        <GroupContext.Provider value={value}>
            {props.children}
        </GroupContext.Provider>
    )
}