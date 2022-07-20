import React, { useEffect, useState } from 'react'
import { CertificateGroupDetail } from '@/types/http'
import { Button, Notify } from 'react-vant'
import { getFirstScreen } from '../services/certificateGroup'
import { CertificateDetail } from '@/types/app'
import { GroupSidebar } from '../components/GroupSidebar'

const Home = () => {
    const [groupList, setGroupList] = useState<CertificateGroupDetail[]>([])
    const [selectedGroup, setSelectedGroup] = useState<number>(0)
    const [certificateList, setCertificateList] = useState<CertificateDetail[]>([])

    useEffect(() => {
        const fetchData = async () => {
            const resp = await getFirstScreen()
            console.log('resp', resp)
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
            <aside className='h-screen w-64 bg-red-300'>
                <GroupSidebar groups={groupList} selectId={selectedGroup} />
            </aside>
            <main className='h-screen bg-blue-100 flex-grow'>

            </main>
        </div>
    )
}

export default Home