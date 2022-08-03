import React, { FC, useContext, useEffect, useRef, useState } from 'react'
import { Form, Overlay, Dialog, hooks, Notify } from 'react-vant'
import { Question, Plus } from '@react-vant/icons'
import { Button } from '@/client/components/Button'
import { AppConfigContext } from './AppConfigProvider'
import CertificateFieldItem from './CertificateFieldItem'
import { CertificateField } from '@/types/app'
import { UserContext } from './UserProvider'
import { useCertificateDetail, useUpdateCertificate } from '../services/certificate'
import { aes, aesDecrypt } from '@/utils/common'

const { useClickAway } = hooks

interface Props {
    groupId: number
    certificateId: number | undefined
    visible: boolean
    onClose: (needRefresh: boolean) => void
}

const DEFAULT_FIELDS: CertificateField[] = [
    { label: '密码', value: '' },
    { label: '网址', value: '' }
]

const CertificateDetail: FC<Props> = (props) => {
    const { groupId, certificateId, visible, onClose } = props
    const [form] = Form.useForm()
    const [config] = useContext(AppConfigContext)
    const { userProfile } = useContext(UserContext)
    // 是否修改了凭证内容
    const [contentChange, setContentChange] = useState(false)
    // 页面是否加载中
    const [loading, setLoading] = useState(true)
    // 密码标题
    const [title, setTitle] = useState('')
    // 新建字段时的累加字段名索引
    const newFieldIndex = useRef(1)
    // 弹出框元素引用
    const dialogRef = useRef<HTMLDivElement>(null)
    // 获取凭证详情
    const { refetch } = useCertificateDetail(certificateId)
    // 提交凭证
    const { mutate, isLoading: submiting } = useUpdateCertificate(() => {
        Notify.show({ type: 'success', message: `${certificateId ? '更新' : '添加'}成功` })
        onClose(true)
    })

    // 初始化窗口
    useEffect(() => {
        if (!userProfile) {
            Notify.show({ type: 'danger', message: '无法解析主密码，请重新登录' })
            return
        }

        const init = async () => {
            setLoading(true)
            if (!certificateId) {
                setTitle('新密码')
                form.setFieldValue('fields', DEFAULT_FIELDS)
                setLoading(false)
                return
            }

            setTitle('载入中')
            const { data: resp } = await refetch()

            if (!resp || resp.code !== 200 || !resp.data) {
                Notify.show({ type: 'danger', message: resp?.msg || '获取凭证失败' })
                setTitle('载入失败')
                return
            }

            setTitle(resp.data.name)
            try {
                const content = JSON.parse(aesDecrypt(resp.data.content, userProfile.password))
                form.setFieldValue('fields', content)
            }
            catch (e) {
                Notify.show({ type: 'danger', message: resp?.msg || '凭证解密失败' })
            }
            setLoading(false)
        }

        init()
    }, [certificateId])

    useEffect(() => {
        if (visible) return
        setContentChange(false)
    }, [visible])

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

    // 点击外部时触发关闭
    useClickAway(dialogRef, (e) => {
        const target = e.target as HTMLElement
        // 由于点击显示弹窗的按钮也会触发 useClickAway
        // 所以这里要判断下只有点击遮罩层的 div 元素时才会触发关闭确认
        if (!target.dataset.outside && !target.classList.contains('overflow-y-auto')) return
        onConfirmClose()
    })

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
            <Form form={form} className='rounded-lg bg-white transition-h pt-4' onValuesChange={onFormChange}>
                <Form.List name="fields">
                    {(fields, { add, remove }) => (<>
                        <div className='flex flex-row flex-wrap'>
                            {fields.map((field, idx) => {
                                return (
                                    <Form.Item
                                        key={idx}
                                        customField
                                        name={[field.name]}
                                    >
                                        <CertificateFieldItem
                                            showDelete={fields.length > 1}
                                            onDelete={() => remove(idx)}
                                        />
                                    </Form.Item>
                                )
                            })}
                        </div>
                        <div className='mx-4 mt-4 pb-4'>
                            <Button
                                plain
                                className='!border-slate-300'
                                block
                                icon={<Plus />}
                                onClick={() => add({ label: '字段' + newFieldIndex.current++, value: '' })}
                            >
                                新增字段
                            </Button>
                        </div>
                    </>)}
                </Form.List>
            </Form>

            <div className='flex flex-row justify-between'>
                <Button
                    className={'!mt-4 ' + (showUpdateBtn ? '!w-[20%] md:!w-[50%] md:!mr-4' : '!w-full')}
                    onClick={onConfirmClose}
                >
                    返回
                </Button>
                {showUpdateBtn && <Button
                    className='!mt-4 !w-[75%] md:!w-[50%]'
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
        <Overlay visible={visible} duration={100} className='overflow-y-auto'>
            <div className='flex justify-center' data-outside>
                <div
                    ref={dialogRef}
                    className='
                        relative bg-slate-200 p-4 mx-4 mt-[50%] md:mt-10 mb-10 rounded-lg
                        w-screen md:w-[70vw] xl:w-[70vw] 2xl:w-[60vw]
                    '
                >
                    <input
                        type="text"
                        value={title}
                        autoFocus
                        onChange={onTitleChange}
                        placeholder="请输入密码名"
                        className='font-bold text-xl bg-inherit mb-4'
                    />
                    <div className='hidden md:flex absolute cursor-default top-5 right-5 items-center text-gray-500'>
                        <Question className='mr-2' /> 标题名和字段名均可修改
                    </div>

                    {renderContent()}
                </div>
            </div>
        </Overlay>
    )
}

export default CertificateDetail