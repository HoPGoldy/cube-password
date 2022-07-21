import { CertificateGroupDetail } from '@/types/http'
import React, { FC, useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GroupContext } from './GroupProvider'

interface TabDetail {
    id: number | string
    name: string
    url: string
}

const STATIC_TABS: TabDetail[] = [
    { id: 'addNew', name: '新增分组', url: '/addGroup' }
]

export const Sidebar: FC = () => {
    const { groupList, selectedGroup, setSelectedGroup } = useContext(GroupContext)
    const [selectedTab, setSelectedTab] = useState<string | number>(0)
    const navigate = useNavigate()

    useEffect(() => {
        if (groupList.length <= 0) return
        setSelectedTab(selectedGroup)
        navigate(`/group/${selectedGroup}`)
    }, [selectedGroup])

    const onTabClick = (id: string | number) => {
        if (selectedTab === id) return
        setSelectedTab(id)
        if (typeof id === 'number') setSelectedGroup(id)
    }

    const renderGroupItem = (group: TabDetail) => {
        const selectedClassName = selectedTab === group.id ? 'sidebar-select' : 'sidebar-not-select'
        return (
            <Link to={group.url} key={group.id}>
                <div
                    className={`ml-2 my-4 p-2 pl-4 transition ${selectedClassName}`}
                    onClick={() => onTabClick(group.id)}
                >
                    {group.name}
                </div>
            </Link>
        )
    }

    const formatGroupItem = (group: CertificateGroupDetail) => {
        return {
            id: group.id,
            name: group.name,
            url: '/group/' + group.id
        }
    }

    return (
        <section className='py-4 pl-4 bg-white h-full'>
            <header className='text-center'>
                密码本
            </header>
            {groupList.map(formatGroupItem).map(renderGroupItem)}
            {STATIC_TABS.map(renderGroupItem)}
        </section>
    )
}
