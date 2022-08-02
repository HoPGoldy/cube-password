import { CertificateGroupDetail } from '@/types/http'
import React, { FC, useContext, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GroupContext } from './GroupProvider'
import { Edit, CouponO } from '@react-vant/icons'
import { getGroupCertificates } from '../services/certificateGroup'
import { Notify } from 'react-vant'

interface TabDetail {
    id: number | string
    name: string
    url: string
    prefix?: () => JSX.Element
}

const STATIC_TABS: TabDetail[] = [
    { id: 'addNew', name: '新增分组', url: '/addGroup', prefix: () => <Edit fontSize={20} /> }
]

export const Sidebar: FC = () => {
    const { groupList, selectedGroup, setSelectedGroup, refetchCertificateList } = useContext(GroupContext)
    const [selectedTab, setSelectedTab] = useState<string | number>(0)
    const navigate = useNavigate()
    const location = useLocation()

    // 当前选中的分组变化了，就切换路由
    useEffect(() => {
        if (groupList.length <= 0) return
        setSelectedTab(selectedGroup)
        navigate(`/group/${selectedGroup}`)
        refetchCertificateList()
    }, [selectedGroup])

    

    // 路由变化时跟随切换侧边栏选中项
    useEffect(() => {
        const { pathname } = location
        if (pathname.startsWith('/group/')) {
            const groupId = pathname.replace('/group/', '')
            setSelectedTab(Number(groupId))
        }
        else {
            const tabInfo = STATIC_TABS.find(tab => tab.url === pathname)
            if (tabInfo) setSelectedTab(tabInfo.id)
        }
    }, [location.pathname])

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
                    className={`ml-2 my-4 p-3 transition flex items-center rounded-tl-lg rounded-bl-lg relative ${selectedClassName}`}
                    onClick={() => onTabClick(group.id)}
                >
                    <div className='top-out-rounded'></div>
                    {group.prefix ? group.prefix() : <CouponO className='shrink-0' fontSize={20} />}
                    <span className='ml-2 whitespace-nowrap text-ellipsis overflow-hidden'>{group.name}</span>
                    <div className='bottom-out-rounded'></div>
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
        <section className='py-4 pl-4 bg-slate-700 h-full text-white'>
            <header className='text-center font-bold text-lg h-[44px] leading-[44px]'>
                密码本
            </header>
            {(groupList || []).map(formatGroupItem).map(renderGroupItem)}
            {STATIC_TABS.map(renderGroupItem)}
        </section>
    )
}
