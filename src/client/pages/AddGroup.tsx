import { CertificateGroup } from '@/types/app'
import { sha } from '@/utils/crypto'
import { nanoid } from 'nanoid'
import React, { useContext } from 'react'
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { addGroup } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Field } from '../components/Field'

interface GroupForm {
    name: string
    password?: string
    passwordConfirm?: string
}

const AddGroup = () => {
    const { setGroupList, setSelectedGroup } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const [form] = Form.useForm<GroupForm>()
    const navigate = useNavigate()

    const onSubmit = async () => {
        const values = await form.validateFields()
        const salt = nanoid(128)

        const postData: CertificateGroup = {
            name: values.name,
            order: 0,
            passwordHash: values.password ? sha(salt + values.password) : undefined,
            passwordSalt: values.password ? salt : undefined
        }

        const resp = await addGroup(postData)

        Notify.show({ type: 'success', message: '分组添加成功' })
        setGroupList(resp.newList)
        setSelectedGroup(resp.newId)
        navigate('/group')
    }

    const validatePassword = async (_: any, value: string) => {
        const pwd = form.getFieldValue('password')
        if (!pwd || value === pwd) return
        throw new Error('两次输入密码不一致!')
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    新建分组
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 2xl:w-1/3 mt-4'>
                    <Form form={form} className='rounded-lg py-4 px-6 bg-white dark:bg-slate-700 dark:text-slate-200'>
                        <Form.Item
                            name="name"
                            label="分组名称"
                            rules={[{ required: true, message: '分组名称不得为空' }]}
                            customField
                        >
                            <Field />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label="分组密码"
                            customField
                        >
                            <Field type='password' />
                        </Form.Item>
                        <Form.Item
                            name="passwordConfirm"
                            validateTrigger="onChange"
                            customField
                            label="重复密码"
                            rules={[{ required: false, validator: validatePassword }]}
                        >
                            <Field type='password' />
                        </Form.Item>
                    </Form>

                    <div className='hidden md:block mt-6'>
                        <Button block onClick={onSubmit} color={config?.buttonColor}>
                            提交
                        </Button>
                    </div>

                    <div className='w-full text-center text-gray-500 dark:text-gray-400 mt-6 cursor-default text-sm'>
                        分组密码非必填<br />
                        填写后仅用于查看分组，凭证依旧使用主密码进行加密
                    </div>
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={onSubmit}>新建</ActionButton>
            </PageAction>
        </div>
    )
}

export default AddGroup