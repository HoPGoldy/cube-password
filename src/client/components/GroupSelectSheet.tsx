import { CertificateGroupDetail } from '@/types/http'
import { CouponO, Coupon, DebitPay, Plus } from '@react-vant/icons'
import React, { FC, useContext, useState } from 'react'
import { Link } from '../Route'
import { ActionSheet } from 'react-vant'
import { ActionIcon } from './PageWithAction'
import { hasGroupLogin, useJwtPayload, UserContext } from './UserProvider'

/**
 * 仅用于移动端的分组选择器
 */
export const GroupSelectSheet: FC = () => {
    const jwtPayload = useJwtPayload()
    const {
        groupList, selectedGroup, setSelectedGroup
    } = useContext(UserContext)
    // 是否显示移动端分组选择弹窗
    const [groupSelectVisivle, setGroupSelectVisivle] = useState(false)

    const onSelectGroup = (item: CertificateGroupDetail) => {
        setSelectedGroup(item.id)
        setGroupSelectVisivle(false)
    }

    const renderStatus = (item: CertificateGroupDetail) => {
        if (!item.requireLogin) return null
        if (hasGroupLogin(jwtPayload, item.id)) {
            return <div className='shrink-0 text-green-500'>已解锁</div>
        }
        return <div className='shrink-0 text-yellow-500'>已加密</div>
    }

    const renderGroupSelectItem = (item: CertificateGroupDetail) => {
        return (
            <div
                key={item.id}
                className='p-4 select-none flex flex-row items-center active:bg-slate-200 dark:active:bg-slate-600 transition'
                onClick={() => onSelectGroup(item)}
            >
                {item.id === selectedGroup
                    ? <Coupon className='shrink-0' fontSize={24} />
                    : <CouponO className='shrink-0' fontSize={24} />}
                <div className='ml-2 grow text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                {renderStatus(item)}
            </div>
        )
    }

    const renderNewGroupBtn = () => {
        return (
            <Link to="/addGroup">
                <div className='
                    p-4 select-none flex flex-row items-center text-gray-400 dark:text-gray-200 active:bg-slate-200 
                    transition
                '>
                    <Plus className='shrink-0' fontSize={24} />
                    <div className='ml-2 grow text-ellipsis whitespace-nowrap overflow-hidden'>新建分组</div>
                </div>
            </Link>
        )
    }

    return (<>
        <ActionSheet
            title={<div className='pt-2 font-bold'>分组选择</div>}
            closeable={false}
            visible={groupSelectVisivle}
            onCancel={() => setGroupSelectVisivle(false)}
            onSelect={item => onSelectGroup(item as CertificateGroupDetail)}
            cancelText="取消"
        >
            {groupList.map(renderGroupSelectItem)}
            {renderNewGroupBtn()}
        </ActionSheet>

        <ActionIcon onClick={() => setGroupSelectVisivle(true)}>
            <DebitPay fontSize={24} />
        </ActionIcon>
    </>)
}
