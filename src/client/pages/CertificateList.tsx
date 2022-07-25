import { CertificateField, CertificateGroup } from '@/types/app'
import { sha } from '@/utils/common'
import { nanoid } from 'nanoid'
import React, { useContext } from 'react'
import { Form, Button, Notify } from 'react-vant'
import { ArrowLeft } from '@react-vant/icons'
import { GroupContext } from '../components/GroupProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { addGroup } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { SettingO } from '@react-vant/icons'
import { CertificateListItem } from '@/types/http'

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

    const onSubmit = async () => {
        const values = await form.validateFields()
        const salt = nanoid(128)

        const postData: CertificateGroup = {
            name: values.name,
            remark: values.remark || undefined,
            passwordSha: values.password ? sha(salt + values.password) : undefined,
            passwordSalt: values.password ? salt : undefined
        }

        const resp = await addGroup(postData)
        if (resp.code !== 200 || !resp.data) {
            Notify.show({ type: 'danger', message: resp.msg || '分组添加失败' })
            return
        }

        Notify.show({ type: 'success', message: '分组添加成功' })
        setGroupList(resp.data.newList)
        setSelectedGroup(resp.data.newId)

        console.log('resp', resp)
    }

    const groupInfo = groupList.find(item => item.id === selectedGroup)

    const renderCertificateItem = (item: CertificateListItem) => {
        return (
            <div
                key={item.id}
                className='mx-2 mb-4 pr-4 bg-white relative rounded-lg py-2 px-4 w-col-1 lg:w-col-2 xl:w-col-3 cursor-pointer'
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
                        <SettingO fontSize={24} className='cursor-pointer mx-4' />
                        <Button color={config?.buttonColor}>
                            + 新建密码
                        </Button>
                    </div>
                </Header>

                <div className='mt-4 mx-2 flex flex-wrap justify-start'>
                    {mockCertificateList.map(renderCertificateItem)}
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={onSubmit}>新建密码</ActionButton>
            </PageAction>
        </div>
    )
}

export default CertificateList