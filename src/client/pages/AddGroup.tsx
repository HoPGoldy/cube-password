import { CertificateGroup } from '@/types/app'
import { sha } from '@/utils/common'
import { nanoid } from 'nanoid'
import React, { useContext, FC } from 'react'
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { addGroup } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

interface GroupForm {
    name: string
    password?: string
    passwordConfirm?: string
}

interface FieldProps {
    type?: 'text' | 'password'
    value?: string
    label?: string
    placeholder?: string
    error?: boolean
    errorMessage?: string
    onChange?: (value: string) => void
}

const Field: FC<FieldProps> = (props) => {
    const { type = 'text', label, value, onChange, error, errorMessage } = props

    const colorClass = error
        ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        : 'border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'

    return (
        <div className='flex flex-col md:flex-row md:items-center'>
            <span className='mr-4'>{label}</span>
            <div className='grow'>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange && onChange(e.target.value)}
                    placeholder={props.placeholder}
                    className={'block px-3 py-2 min-h-[42px] my-2 w-full transition ' +
                        'border border-solid rounded-md shadow-sm placeholder-slate-400 ' +
                        'focus:outline-none ' + colorClass}
                />
                {error && <div className='text-red-500 text-sm'>{errorMessage}</div>}
            </div>
        </div>
    )
}

const AddGroup = () => {
    const { setGroupList, setSelectedGroup } = useContext(UserContext)
    const [config] = useContext(AppConfigContext)
    const [form] = Form.useForm<GroupForm>()
    const navigate = useNavigate()

    const onSubmit = async () => {
        const values = await form.validateFields()
        const salt = nanoid(128)

        const postData: CertificateGroup = {
            name: values.name,
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

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 2xl:w-1/3 mt-4'>
                    <Form form={form} className='rounded-lg py-4 px-6 bg-white'>
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

                    <div className='w-full text-center text-gray-500 mt-6 select-none text-sm'>
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