import React, { FC, useContext, useEffect, useRef, useState } from 'react'
import { Form, Popup, Dialog, Notify } from 'react-vant'
import { Question, Plus } from '@react-vant/icons'
import { Button } from '@/client/components/Button'
import { AppConfigContext } from './AppConfigProvider'
import CertificateFieldItem from './CertificateFieldItem'
import { CertificateField } from '@/types/app'
import { UserContext } from './UserProvider'
import { useCertificateDetail, useUpdateCertificate } from '../services/certificate'
import { aes, aesDecrypt } from '@/utils/common'
import copy from 'copy-to-clipboard'

interface Props {
    groupId: number
    certificateId: number | undefined
    visible: boolean
    onClose: (needRefresh: boolean) => void
}

const DEFAULT_FIELDS: CertificateField[] = [
    { label: '网址', value: '' },
    { label: '用户名', value: '' },
    { label: '密码', value: '' },
    { label: '备注', value: '' }
]

const CertificateDetail: FC<Props> = (props) => {
    const { groupId, certificateId, visible, onClose } = props
    const [form] = Form.useForm()
    const config = useContext(AppConfigContext)
    const { userProfile } = useContext(UserContext)
    // 是否禁用编辑，在查看详情时为 true
    const [disabled, setDisabled] = useState(true)
    // 是否修改了凭证内容
    const [contentChange, setContentChange] = useState(false)
    // 页面是否加载中
    const [loading, setLoading] = useState(true)
    // 密码标题
    const [title, setTitle] = useState('')
    // 新建字段时的累加字段名索引
    const newFieldIndex = useRef(1)
    // 标题输入框
    const titleInputRef = useRef<HTMLInputElement>(null)
    // 获取凭证详情
    const { refetch } = useCertificateDetail(certificateId)
    // 提交凭证
    const { mutate, isLoading: submiting } = useUpdateCertificate(() => {
        Notify.show({ type: 'success', message: `${certificateId ? '更新' : '添加'}成功` })
        onClose(true)
    })

    // 初始化窗口
    useEffect(() => {
        if (!visible) {
            setContentChange(false)
            setDisabled(true)
            return
        }
        
        if (!userProfile) {
            Notify.show({ type: 'danger', message: '无法解析主密码，请重新登录' })
            return
        }

        const init = async () => {
            setLoading(true)
            if (!certificateId) {
                setTitle('新密码')
                form.setFieldValue('fields', DEFAULT_FIELDS)
                setTimeout(() => {
                    // 默认选中输入框内容
                    titleInputRef.current?.select()
                    titleInputRef.current?.focus()
                }, 500)
                setLoading(false)
                setDisabled(false)
                return
            }

            setTitle('载入中')
            const { data: resp } = await refetch()
            if (!resp) {
                setTitle('载入失败')
                return
            }

            setTitle(resp.name)
            try {
                const content = JSON.parse(aesDecrypt(resp.content, userProfile.password))
                form.setFieldValue('fields', content)
            }
            catch (e) {
                Notify.show({ type: 'danger', message: '凭证解密失败' })
            }
            setLoading(false)
        }

        init()
    }, [visible])

    // 复制完整凭证内容
    const onCopyTotal = async () => {
        await Dialog.confirm({
            title: '确定要复制完整凭证？',
            message: '所有加密信息都将以明文展示，请确保索要凭证的人值得信赖。'
        })

        let content = title + '\n\n'
        const formData = form.getFieldsValue()
        formData.fields?.map((field: CertificateField) => {
            content += field.label + '\n' + field.value + '\n\n'
        })

        copy(content)
        Notify.show({ type: 'success', message: '凭证已复制' })
    }

    const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value)
        setContentChange(true)
    }

    const onFormChange = () => {
        setContentChange(true)
    }

    // 提交回调
    const onFinish = async () => {
        const { fields } = form.getFieldsValue()
        if (!userProfile) {
            Notify.show({ type: 'danger', message: '无法解析主密码，请重新登录' })
            return
        }

        mutate({
            id: certificateId,
            name: title,
            content: aes(JSON.stringify(fields), userProfile.password),
            groupId
        })
    }

    // 关闭弹出框确认
    const onConfirmClose = async () => {
        if (contentChange) {
            await Dialog.confirm({
                message: '确定要关闭吗？未保存的内容都将丢失',
                confirmButtonText: '关闭',
                confirmButtonColor: '#ef4444'
            })
        }
        onClose(false)
    }

    const needShowUpdateButton = () => {
        if (loading) return false
        // 新增时一定显示
        if (!certificateId) return true

        // 如果查看详情时没有修改内容，则不显示
        return contentChange
    }

    const showUpdateBtn = needShowUpdateButton()

    const renderContent = () => {
        if (loading) return (
            <div className='flex justify-center items-center'>
                解密中...
            </div>
        )

        return (<>
            <Form form={form} className='rounded-lg bg-white dark:bg-slate-600 transition-h pt-4' onValuesChange={onFormChange}>
                <Form.List name="fields">
                    {(fields, { add, remove }) => (<>
                        <div className='flex flex-row flex-wrap'>
                            {fields.map((field, idx) => {
                                return (
                                    <Form.Item
                                        key={idx}
                                        customField
                                        name={[field.name]}
                                        disabled={disabled}
                                    >
                                        <CertificateFieldItem
                                            showDelete={fields.length > 1}
                                            onDelete={() => remove(idx)}
                                        />
                                    </Form.Item>
                                )
                            })}
                        </div>
                        {!disabled && <div className='mx-4 mt-4 pb-4'>
                            <Button
                                plain
                                className='!border-slate-300 dark:!border-slate-500'
                                block
                                icon={<Plus />}
                                onClick={() => add({ label: '字段' + newFieldIndex.current++, value: '' })}
                            >
                                新增字段
                            </Button>
                        </div>}
                    </>)}
                </Form.List>
            </Form>

            <div className='flex flex-row justify-between gap-4'>
                {disabled && <Button
                    className='!mt-4 grow'
                    onClick={() => setDisabled(old => !old)}
                >编辑</Button>}

                {disabled && <Button
                    className='!mt-4 grow'
                    onClick={onCopyTotal}
                >复制</Button>}

                <Button
                    className='!mt-4 grow'
                    onClick={onConfirmClose}
                >返回</Button>

                {showUpdateBtn && <Button
                    className='!mt-4 grow'
                    color={config?.buttonColor}
                    onClick={onFinish}
                    loading={submiting}
                >
                    {certificateId ? '更新' : '保存'}
                </Button>}
            </div>
        </>)
    }

    return (
        <Popup
            round
            className='w-[90%] md:w-[70vw] xl:w-[70vw] 2xl:w-[60vw]'
            visible={visible}
            onClose={onConfirmClose}
        >
            <div className='relative bg-slate-200 dark:bg-slate-700 p-4 rounded-lg'>
                <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    disabled={disabled}
                    onChange={onTitleChange}
                    placeholder="请输入密码名"
                    className='font-bold dark:text-slate-200 text-xl bg-inherit mb-4'
                />
                {!disabled && <div className='
                    hidden md:flex absolute cursor-default top-5 right-5 items-center 
                    text-gray-500 dark:text-gray-200
                '>
                    <Question className='mr-2' /> 标题名和字段名均可修改
                </div>}

                {renderContent()}
            </div>
        </Popup>
    )
}

export default CertificateDetail