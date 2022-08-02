import React, { FC, useContext, useEffect, useRef, useState } from 'react'
import { Form, Overlay, Dialog, hooks, Notify } from 'react-vant'
import { Question, Plus } from '@react-vant/icons'
import { Button } from '@/client/components/Button'
import { AppConfigContext } from './AppConfigProvider'
import CertificateFieldItem from './CertificateFieldItem'
import { CertificateField } from '@/types/app'
import { UserContext } from './UserProvider'
import { addCertificate, getCertificate, updateCertificate } from '../services/certificate'
import { AppResponse } from '@/types/global'
import { aes } from '@/utils/common'

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
    const [userProfile] = useContext(UserContext)
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

    // 初始化窗口
    useEffect(() => {
        setContentChange(false)

        const init = async () => {
            if (!userProfile) {
                Notify.show({ type: 'danger', message: '无法解析主密码，请重新登录' })
                return
            }

            if (certificateId) {
                setLoading(true)
                setTitle('载入中')
                const resp = await getCertificate(certificateId, userProfile.password)
                setLoading(false)

                if (resp.code !== 200 || !resp.data) {
                    Notify.show({ type: 'danger', message: resp.msg || '获取凭证失败' })
                    return
                }
                setTitle(resp.data.name)
                form.setFieldValue('fields', resp.data.content)
            }
            else {
                setTitle('新密码')
                setLoading(false)
                form.setFieldValue('fields', DEFAULT_FIELDS)
            }
        }

        init()
    }, [certificateId])

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

        let resp: AppResponse
        // 更新凭证
        if (certificateId) {
            resp = await updateCertificate(certificateId, {
                name: title,
                groupId,
                content: aes(JSON.stringify(fields), userProfile.password)
            })
        }
        // 新增凭证
        else {
            resp = await addCertificate(title, groupId, fields, userProfile.password)
        }

        const tip = certificateId ? '更新' : '添加'
        if (resp.code !== 200) {
            Notify.show({ type: 'danger', message: resp.msg || `${tip}失败` })
            return
        }

        Notify.show({ type: 'success', message: `${tip}成功` })
        onClose(true)
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
                        <div className='mx-4 pt-4 pb-6'>
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
                    className={'!mt-4 md:!mr-4 ' + (showUpdateBtn ? '!w-[20%] md:!w-[50%]' : '!w-full')}
                    onClick={onConfirmClose}
                >
                    返回
                </Button>
                {showUpdateBtn && <Button
                    className='!mt-4 !w-[75%] md:!w-[50%]'
                    color={config?.buttonColor}
                    onClick={onFinish}
                >
                    {certificateId ? '更新' : '提交'}
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
                        onChange={onTitleChange}
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