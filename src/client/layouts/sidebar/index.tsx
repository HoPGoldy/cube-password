import React, { FC, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InsertRowLeftOutlined, RightOutlined, SettingOutlined, LockOutlined } from '@ant-design/icons'
import { Button, Space } from 'antd'
import s from './styles.module.css'
import { CertificateGroupDetail } from '@/types/group'
import { useAtomValue } from 'jotai'
import { stateGroupList } from '@/client/store/user'
import { useAddGroupContent } from '@/client/pages/certificateList/hooks/useAddGroup'

export const Sidebar: FC = () => {
    /** 分组列表 */
    const groups = useAtomValue(stateGroupList)
    /** 当前所处的分组 */
    const { groupId } = useParams()
    /** 新增分组 */
    const addGroup = useAddGroupContent()

    const renderGroupItem = (item: CertificateGroupDetail) => {
        const className = [s.menuItem]
        if (groupId && +groupId === item.id) className.push(s.menuItemActive)

        return (
            <Link key={item.id} to={`/group/${item.id}`}>
                <div
                    className={className.join(' ')}
                    title={item.name}
                >
                    <span className="truncate">{item.name}</span>
                    {item.requireLogin ? <LockOutlined /> : <RightOutlined />}
                </div>
            </Link>
        )
    }

    return (
        <section className={s.sideberBox}>
            <div className="flex flex-row flex-nowrap items-center justify-center">
                <div className="font-black text-lg">密码本</div>
            </div>

            <div className="flex-grow flex-shrink overflow-y-auto noscrollbar overflow-x-hidden my-3">
                <Space direction="vertical" style={{ width: '100%' }}>
                    {groups.map(renderGroupItem)}
                </Space>
            </div>

            <Button
                className={`${s.toolBtn} keep-antd-style`}
                icon={<InsertRowLeftOutlined />}
                block
                onClick={() => addGroup.setShowAddModal(true)}
            >新建分组</Button>
            {addGroup.renderContent()}
        </section>
    )
}
