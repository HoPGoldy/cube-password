import React, { FC, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Form, Popup, Dialog, Notify } from 'react-vant'
import { Question, Plus, Like } from '@react-vant/icons'
import { Button } from '@/client/components/Button'
import { AppConfigContext } from './AppConfigProvider'
import CertificateFieldItem from './CertificateFieldItem'
import { CertificateField } from '@/types/app'
import { UserContext } from './UserProvider'
import { useCertificateDetail, useUpdateCertificate } from '../services/certificate'
import { aes, aesDecrypt } from '@/utils/crypto'
import copy from 'copy-to-clipboard'
import { customAlphabet } from 'nanoid'
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH } from '@/constants'

interface UseTip {
    name: string
    content: string
}

const useTips: UseTip[] = [
    {
        name: '修改名称',
        content: '在编辑模式下，标题名和字段名均可修改。'
    },
    {
        name: '密码生成',
        content: '当字段名中包含 “密码”、“password”、“pwd” 时，将会显示密码生成按钮，点击后会生成 18 位的强密码并复制到剪切板。'
    },
    {
        name: '用户名',
        content: '当字段名中包含 “用户名”、“name” 时，将会显示用户名生成按钮，点击后会生成首字母大写的英文名并复制到剪切板。'
    },
    {
        name: '复制与跳转',
        content: '在查看凭证时，直接点击字段内容将会直接复制，如果内容以 http https 开头，将会直接跳转到对应网址。'
    }
]

const MARK_COLORS: string[] = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']

interface Props {
    groupId: number
    certificateId: number | undefined
    visible: boolean
    onClose: (needRefresh: boolean) => void
}

const DEFAULT_FIELDS: CertificateField[] = [
    { label: '网址', value: '' },
    { label: '用户名', value: '' },
    { label: '密码', value: '' }
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
    // 获取凭证详情
    const { refetch } = useCertificateDetail(certificateId)
    // 标记颜色
    const [markColor, setMarkColor] = useState('')
    // 是否显示颜色选择框
    const [colorPickerVisible, setColorPickerVisible] = useState(false)
    // 提交凭证
    const { mutate, isLoading: submiting } = useUpdateCertificate(() => {
        Notify.show({ type: 'success', message: `${certificateId ? '更新' : '添加'}成功` })
        onClose(true)
    })
    // 操作帮助是否显示
    const [useTipVisible, setUseTipVisible] = useState(false)

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
            setMarkColor('')
            if (!certificateId) {
                form.setFieldValue('fields', DEFAULT_FIELDS)
                setTitle('新密码')
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
            setMarkColor(resp.markColor)
            try {
                const content = JSON.parse(aesDecrypt(resp.content, userProfile.pwdKey, userProfile.pwdIv))
                form.setFieldValue('fields', content)
            }
            catch (e) {
                Notify.show({ type: 'danger', message: '凭证解密失败' })
            }
            setLoading(false)
        }

        init()
    }, [visible])

    const createPwd = useMemo(() => {
        const {
            createPwdAlphabet = DEFAULT_PASSWORD_ALPHABET,
            createPwdLength = DEFAULT_PASSWORD_LENGTH
        } = userProfile || {}
        return customAlphabet(createPwdAlphabet, createPwdLength)
    }, [userProfile?.createPwdAlphabet, userProfile?.createPwdLength])

    // 复制完整凭证内容
    const onCopyTotal = async () => {
        await Dialog.confirm({
            title: <div className='dark:text-slate-200'>确定要复制完整凭证？</div>,
            message: <div className='dark:text-slate-200'>所有加密信息都将以明文展示，请确保索要凭证的人值得信赖。</div>
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
            markColor,
            content: aes(JSON.stringify(fields), userProfile.pwdKey, userProfile.pwdIv),
            groupId
        })
    }

    // 关闭弹出框确认
    const onConfirmClose = async () => {
        if (contentChange) {
            await Dialog.confirm({
                message: <div className='dark:text-slate-200'>确定要关闭吗？未保存的内容都将丢失</div>,
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

    const renderUseTip = (item: UseTip) => {
        return (
            <div className='mb-4' key={item.name}>
                <div className='font-bold mb-1 dark:text-gray-400'>{item.name}</div>
                <div className='text-gray-600 dark:text-gray-200'>{item.content}</div>
            </div>
        )
    }

    const renderMarkColor = (color: string) => {
        return (
            <div
                key={color}
                className={
                    'w-6 h-6 rounded-full cursor-pointer m-4 hover:ring-2 hover:ring-gray-300 ' +
                    'active:ring-slate-700 dark:active:ring-slate-300 transition ' +
                    (markColor === color ? 'ring-2 ring-slate-700 dark:ring-slate-300 ' : '') +
                    (color === '' ? 'remove-mark-color' : '')
                }
                style={{ backgroundColor: color }}
                onClick={() => {
                    setMarkColor(color)
                    setColorPickerVisible(false)
                    setContentChange(true)
                }}
            />
        )
    }

    const renderContent = () => {
        if (loading) return (
            <div className='flex justify-center items-center dark:text-slate-200'>
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
                                            createPwd={createPwd}
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
            className='w-[90%] md:w-[60vw] xl:w-[40vw] 2xl:w-[30vw]'
            visible={visible}
            onClose={onConfirmClose}
        >
            <div className='relative bg-slate-200 dark:bg-slate-700 p-4 rounded-lg'>
                <input
                    type="text"
                    value={title}
                    disabled={disabled}
                    onChange={onTitleChange}
                    placeholder="请输入密码名"
                    className='font-bold dark:text-slate-200 text-xl bg-inherit mb-4'
                />
                <div className='
                    absolute top-5 right-5 cursor-pointer
                    text-gray-500 dark:text-gray-200
                '>
                    <Question fontSize={24} onClick={() => setUseTipVisible(true)} /> 
                </div>
                <div className='
                    absolute top-5 right-14 cursor-pointer
                    text-gray-500 dark:text-gray-200
                '>
                    <Like fontSize={24} color={markColor} onClick={() => {
                        if (disabled) Notify.show({ type: 'warning', message: '请先启用编辑' })
                        else setColorPickerVisible(true)
                    }} />
                </div>

                {renderContent()}
            </div>
            <Popup
                round
                className='w-[90%] md:w-1/2'
                visible={useTipVisible}
                onClose={() => setUseTipVisible(false)}
            >
                <div className='p-4' onClick={() => setUseTipVisible(false)}>
                    {useTips.map(renderUseTip)}
                </div>
            </Popup>
            <Popup
                round
                className='w-[90%] md:w-1/2'
                visible={colorPickerVisible}
                onClose={() => setColorPickerVisible(false)}
            >
                <div className='p-4 flex flex-row flex-wrap justify-center'>
                    {MARK_COLORS.map(renderMarkColor)}
                    {renderMarkColor('')}
                </div>
            </Popup>
        </Popup>
    )
}

export default CertificateDetail