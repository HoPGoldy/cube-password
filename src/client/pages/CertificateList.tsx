import React, { useContext, useState } from 'react'
import { Button } from '@/client/components/Button'
import { Loading } from 'react-vant'
import { ArrowLeft, SettingO } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { CertificateListItem } from '@/types/http'
import CertificateDetail from '../components/CertificateDetail'

const CertificateList = () => {
    const { certificateList, groupList, selectedGroup, refetchCertificateList, certificateListLoading } = useContext(UserContext)
    const [config] = useContext(AppConfigContext)
    const navigate = useNavigate()

    // 是否显示详情页
    const [detailVisible, setDetailVisible] = useState(false)
    // 当前详情页显示的密码 id，设为空来显示新增页
    const [showCertificateId, setShowCertificateId] = useState<number | undefined>(undefined)

    const onAddCertificate = async (certificateId: number | undefined) => {
        setDetailVisible(true)
        setShowCertificateId(certificateId)
    }

    const onDetailClose = () => {
        refetchCertificateList()
        setDetailVisible(false)
    }

    const groupInfo = groupList.find(item => item.id === selectedGroup)

    const renderCertificateItem = (item: CertificateListItem) => {
        return (
            <div
                key={item.id}
                className='
                    mx-2 mb-4 pr-4 bg-white relative rounded-lg py-2 px-4
                    w-col-1 lg:w-col-2 xl:w-col-3 cursor-pointer
                    hover:ring ring-slate-500 active:bg-slate-200 transition
                '
                onClick={() => onAddCertificate(item.id)}
            >
                <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                <div className='text-gray-600'>{item.updateTime}</div>
            </div>
        )
    }

    const renderCertificateList = () => {
        if (!certificateList || certificateListLoading) return (
            <div className='flex justify-center items-center text-gray-400 w-full mt-16 select-none'>
                <Loading className='mr-2' /> 加载中，请稍后...
            </div>
        )
        if (certificateList.length === 0) return (
            <div className='flex justify-center items-center text-gray-400 w-full mt-16 select-none'>
                暂无密码
            </div>
        )
        return (
            <div className='mt-4 mx-2 flex flex-wrap justify-start'>
                {certificateList.map(renderCertificateItem)}
            </div>
        )
    }

    return (
        <div>
            <PageContent>
                <Header>
                    <div className='grow shrink ml-2 overflow-hidden flex flex-col justify-center'>
                        <div
                            className='text-lg md:text-ellipsis md:whitespace-nowrap md:overflow-hidden'
                            title={groupInfo?.name}
                        >
                            {groupInfo?.name}
                        </div>
                        {groupInfo?.remark && 
                        <div
                            className='mt-2 md:mt-0 text-sm text-slate-500 md:text-ellipsis md:whitespace-nowrap md:overflow-hidden'
                            title={groupInfo?.remark}
                        >
                            {groupInfo?.remark}
                        </div>}
                    </div>
                    <div className='shrink-0 items-center hidden md:flex flex-nowrap'>
                        <SettingO fontSize={24} className='cursor-pointer mx-4 hover:opacity-75' />
                        <Button color={config?.buttonColor} onClick={() => onAddCertificate(undefined)}>
                            + 新建密码
                        </Button>
                    </div>
                </Header>

                {renderCertificateList()}

                <CertificateDetail
                    visible={detailVisible}
                    onClose={onDetailClose}
                    groupId={selectedGroup}
                    certificateId={showCertificateId}
                />
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={() => onAddCertificate(undefined)}>新建密码</ActionButton>
            </PageAction>
        </div>
    )
}

export default CertificateList