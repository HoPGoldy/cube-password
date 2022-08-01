import { CertificateField, CertificateGroup } from '@/types/app'
import { sha } from '@/utils/common'
import { nanoid } from 'nanoid'
import React, { useContext, useState } from 'react'
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { GroupContext } from '../components/GroupProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { addGroup } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { SettingO } from '@react-vant/icons'
import { CertificateListItem } from '@/types/http'
import CertificateDetail from '../components/CertificateDetail'

interface GroupForm {
    name: string
    password?: string
    passwordConfirm?: string
    remark?: string
}

export interface CertificateItem {
    id: number
    name: string
    groupId: number
    updateTime: number
    password: string
    otherFields: CertificateField[]
}

const mockCertificateList: CertificateListItem[] = [
    { id: 1, name: 'b站', updateTime: '2022-07-25' },
    { id: 2, name: '知乎', updateTime: '2022-07-25' },
    { id: 3, name: '微博', updateTime: '2022-07-25' },
    { id: 4, name: '抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音抖音', updateTime: '2022-07-25' },
    { id: 5, name: '美团', updateTime: '2022-07-25' },
    { id: 6, name: '腾讯', updateTime: '2022-07-25' },
    { id: 7, name: '淘宝', updateTime: '2022-07-25' },
    
]

const CertificateList = () => {
    const { setGroupList, setSelectedGroup, groupList, selectedGroup } = useContext(GroupContext)
    const [config] = useContext(AppConfigContext)
    const [form] = Form.useForm<GroupForm>()
    const navigate = useNavigate()

    const [detailVisible, setDetailVisible] = useState(false)
    const [showCertificateId, setShowCertificateId] = useState(undefined)

    const onAddCertificate = async () => {
        setDetailVisible(true)
        setShowCertificateId(undefined)
    }

    const groupInfo = groupList.find(item => item.id === selectedGroup)

    const renderCertificateItem = (item: CertificateListItem) => {
        return (
            <div
                key={item.id}
                className='mx-2 mb-4 pr-4 bg-white relative rounded-lg py-2 px-4 w-col-1 lg:w-col-2 xl:w-col-3 cursor-pointer hover:ring ring-slate-500 active:bg-slate-200 transition'
            >
                <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                <div className='text-gray-600'>{item.updateTime}</div>
                {/* <div
                    style={{ background: config?.buttonColor }}
                    className='absolute transition top-0 right-0 bottom-0 w-2 opacity-50 rounded-r-lg'
                ></div> */}
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
                        <Button color={config?.buttonColor} onClick={onAddCertificate}>
                            + 新建密码
                        </Button>
                    </div>
                </Header>

                <div className='mt-4 mx-2 flex flex-wrap justify-start'>
                    {mockCertificateList.map(renderCertificateItem)}
                </div>

                <CertificateDetail visible={detailVisible} onClose={() => setDetailVisible(false)} />
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={onAddCertificate}>新建密码</ActionButton>
            </PageAction>
        </div>
    )
}

export default CertificateList