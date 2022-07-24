import { CertificateGroup } from '@/types/app'
import { sha } from '@/utils/common'
import { nanoid } from 'nanoid'
import React, { useContext } from 'react'
import { Form, Card, Field, Space, Button, Notify } from 'react-vant'
import { ArrowLeft } from '@react-vant/icons'
import { GroupContext } from '../components/GroupProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { addGroup } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

interface GroupForm {
    name: string
    password?: string
    passwordConfirm?: string
    remark?: string
}

const CertificateList = () => {
    const { setGroupList, setSelectedGroup } = useContext(GroupContext)
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

    return (
        <div>
            <PageContent>
                <div className='m-4'>
                    <Space direction="vertical" gap={16} className='w-full'>
                        <div className='flex'>
                            <Header className='grow mr-4'>
                                我的密码
                            </Header>

                            <Button color={config?.buttonColor} style={{ height: 44 }}>
                                新建密码
                            </Button>
                        </div>
                    </Space>
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