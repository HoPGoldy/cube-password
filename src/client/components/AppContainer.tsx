import React, { useContext, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Notify } from 'react-vant'
import { Sidebar } from './Sidebar'
import { getFirstScreen } from '../services/certificateGroup'
import { GroupContext } from './GroupProvider'

export const AppContainer = () => {
    const { setGroupList, setSelectedGroup, setCertificateList } = useContext(GroupContext)

    useEffect(() => {
        const fetchData = async () => {
            const resp = await getFirstScreen()
            if (resp.code !== 200 || !resp.data) {
                Notify.show({ type: 'danger', message: resp.msg || '获取数据失败' })
                return
            }

            setGroupList(resp.data.groups)
            setSelectedGroup(resp.data.defaultGroupId)
            setCertificateList(resp.data.certificates)
        }
        fetchData()
    }, [])

    return (
        <div className='flex'>
            <aside className='h-screen w-sidebar hidden md:block'>
                <Sidebar />
            </aside>
            <main className='h-screen w-page-content flex-grow'>
                <Outlet />
            </main>
        </div>
    )
}