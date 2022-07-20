import { CertificateGroupDetail } from '@/types/http'
import React, { FC } from 'react'

interface Props {
    groups: CertificateGroupDetail[],
    selectId: number
}

export const GroupSidebar: FC<Props> = (props) => {
    const { groups, selectId } = props

    const renderGroupItem = (group: CertificateGroupDetail) => {
        return (
            <li key={group.id}>
                {group.name}
            </li>
        )
    }

    return (
        <div>
            {groups.map(renderGroupItem)}
        </div>
    )
}