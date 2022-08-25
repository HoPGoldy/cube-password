import { CertificateGroupDetail } from '@/types/http'
import { CouponO, DebitPay } from '@react-vant/icons'
import React, { FC, useContext, useState } from 'react'
import { ActionSheet } from 'react-vant'
import { ActionIcon } from './PageWithAction'
import { UserContext } from './UserProvider'

/**
 * 仅用于移动端的分组选择器
 */
export const GroupSelectSheet: FC = () => {
    const {
        groupList, setSelectedGroup
    } = useContext(UserContext)
    // 是否显示移动端分组选择弹窗
    const [groupSelectVisivle, setGroupSelectVisivle] = useState(false)

    const onSelectGroup = (item: CertificateGroupDetail) => {
        setSelectedGroup(item.id)
        setGroupSelectVisivle(false)
    }

    const renderStatus = (item: CertificateGroupDetail) => {
        if (!item.requireLogin) return null
        return <div className='shrink-0 text-yellow-500'>已加密</div>
    }

    const renderGroupSelectItem = (item: CertificateGroupDetail) => {
        return (
            <div
                key={item.id}
                className={
                    'p-4 select-none flex flex-row items-center bg-white relative ' +
                    'active:bg-slate-200 transition '
                }
                onClick={() => onSelectGroup(item)}
            >
                <CouponO className='shrink-0' fontSize={24} />
                <div className='ml-2 grow text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                {renderStatus(item)}
            </div>
        )
    }

    return (<>
        <ActionSheet
            title={<div className='font-bold pt-1 bg-gray-50'>分组选择</div>}
            closeable={false}
            visible={groupSelectVisivle}
            onCancel={() => setGroupSelectVisivle(false)}
            onSelect={item => onSelectGroup(item as CertificateGroupDetail)}
            cancelText="取消"
        >
            {groupList.map(renderGroupSelectItem)}
        </ActionSheet>

        <ActionIcon onClick={() => setGroupSelectVisivle(true)}>
            <DebitPay fontSize={24} />
        </ActionIcon>
    </>)
}
