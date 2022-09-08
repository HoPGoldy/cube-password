import { CertificateGroupDetail } from '@/types/http'
import React, { FC, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from '../Route'
import { Plus, Gem, Coupon, Lock, Setting } from '@react-vant/icons'
import { UserContext } from './UserProvider'

interface TabDetail {
    id: number | string
    name: string
    url: string
    requireLogin?: boolean
    prefix?: () => JSX.Element
}

const STATIC_TABS: TabDetail[] = [
    { id: 'addNew', name: '新增分组', url: '/addGroup', prefix: () => <Plus fontSize={20} /> },
    { id: 'securityEntry', name: '安全管理', url: '/securityEntry', prefix: () => <Gem fontSize={20} /> },
    { id: 'setting', name: '设置', url: '/Setting', prefix: () => <Setting fontSize={20} /> }
]

export const Sidebar: FC = () => {
    const { groupList, selectedGroup, setSelectedGroup } = useContext(UserContext)
    const [selectedTab, setSelectedTab] = useState<string | number>(0)
    const navigate = useNavigate()
    const location = useLocation()

    // 当前选中的分组变化了，高亮对应的 tab
    useEffect(() => {
        if (groupList.length <= 0) return
        setSelectedTab(selectedGroup)
    }, [selectedGroup])

    // 路由变化时监听一下，如果切换到了非分组 tab，就高亮对应的 tab
    useEffect(() => {
        const { pathname } = location
        const tabInfo = STATIC_TABS.find(tab => tab.url === pathname)
        if (tabInfo) setSelectedTab(tabInfo.id)
    }, [location.pathname])

    // 切换 tab，如果是非分组，就直接导航
    const onTabClick = (tabItem: TabDetail) => {
        const { id, url } = tabItem
        if (selectedTab === id && location.pathname === url) return

        if (typeof id === 'number') setSelectedGroup(id)
        // 路由不同了才会跳，不然会出现页面闪烁的情况
        if (location.pathname !== url) navigate(url)
        setSelectedTab(tabItem.id)
    }

    const renderTabIcon = (group: TabDetail) => {
        if (group.prefix) return group.prefix()
        if (group.requireLogin) return <Lock className='shrink-0' fontSize={20} />
        return <Coupon className='shrink-0' fontSize={20} />
    }

    const renderGroupItem = (group: TabDetail) => {
        const selectedClassName = selectedTab === group.id ? 'sidebar-select' : 'sidebar-not-select'
        return (
            <div
                key={group.id}
                className={`ml-2 my-4 p-3 transition flex items-center rounded-tl-lg rounded-bl-lg relative select-none cursor-pointer ${selectedClassName}`}
                onClick={() => onTabClick(group)}
            >
                <div className='top-out-rounded'></div>
                {renderTabIcon(group)}
                <span className='ml-2 whitespace-nowrap text-ellipsis overflow-hidden'>{group.name}</span>
                <div className='bottom-out-rounded'></div>
            </div>
        )
    }

    const formatGroupItem = (group: CertificateGroupDetail) => {
        return {
            id: group.id,
            name: group.name,
            requireLogin: group.requireLogin,
            url: '/group'
        }
    }

    return (
        <section className='
            py-4 pl-4 transition h-screen overflow-y-auto 
            bg-slate-700 dark:bg-slate-900 text-white dark:text-gray-200
        '>
            <header className='text-center font-bold text-lg h-[44px] leading-[44px]'>
                密码本
            </header>
            {(groupList || []).map(formatGroupItem).map(renderGroupItem)}
            <div className='my-4 mx-4 mr-8 bg-slate-400 h-[1px]'></div>
            {STATIC_TABS.map(renderGroupItem)}
        </section>
    )
}
