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

const AddGroup = () => {
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
    }

    const validatePassword = async (_: any, value: string) => {
        if (value === form.getFieldValue('password')) return
        throw new Error('两次输入密码不一致!')
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    新建分组
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 mt-4'>
                    <Card round>
                        <Form
                            colon
                            form={form}
                            inputAlign="left"
                        >
                            <Form.Item
                                name="name"
                                label="分组名称"
                                rules={[{ required: true, message: '分组名称不得为空' }]}
                            >
                                <Field required placeholder="请输入分组名称" />
                            </Form.Item>
                            <Form.Item
                                name="password"
                                label="分组密码"
                            >
                                <Field type="password" placeholder="可选，查看该分组内容时需要输入此密码" />
                            </Form.Item>
                            <Form.Item
                                name="passwordConfirm"
                                label="重复密码"
                                validateTrigger="onChange"
                                rules={[{ required: false, validator: validatePassword }]}
                            >
                                <Field type="password" placeholder="请输入相同的密码" />
                            </Form.Item>
                            <Form.Item name="remark" label="分组备注">
                                <Field
                                    rows={2}
                                    autosize
                                    type="textarea"
                                    placeholder="请输入备注内容"
                                    maxlength={50}
                                    showWordLimit
                                />
                            </Form.Item>
                        </Form>
                    </Card>

                    <div className='hidden md:block mt-4'>
                        <Button type="primary" block onClick={onSubmit} color={config?.buttonColor}>
                            提交
                        </Button>
                    </div>
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={onSubmit}>提交</ActionButton>
            </PageAction>
        </div>
    )
}

export default AddGroup