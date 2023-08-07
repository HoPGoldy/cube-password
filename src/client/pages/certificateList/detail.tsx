import React, { FC, MouseEventHandler, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageContent, PageAction } from '../../layouts/pageWithAction'
import Loading from '../../layouts/loading'
import { Button, Form, Image, Input, Modal, Space } from 'antd'
import { PlusOutlined, CloseOutlined, GiftOutlined } from '@ant-design/icons'
import { PageTitle } from '@/client/components/pageTitle'
import { useQueryDiaryList } from '@/client/services/diary'
import { DiaryListItem } from './listItem'
import { useOperation } from './operation'
import s from './styles.module.css'
import copy from 'copy-to-clipboard'
import { CertificateField } from '@/types/certificate'
import { messageSuccess, messageWarning } from '@/client/utils/message'
import { getRandName, useSaveCertificate } from '@/client/services/certificate'
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH, STATUS_CODE } from '@/config'
import { openNewTab } from '@/utils/common'
import { customAlphabet } from 'nanoid'
import { DetailTitle } from './components/detailTitle'
import { aes } from '@/utils/crypto'
import { useAtomValue } from 'jotai'
import { stateMainPwd, stateUser } from '@/client/store/user'

interface FieldListProps {
    showDelete?: boolean
    value?: CertificateField
    disabled?: boolean
    onChange?: (value: CertificateField) => void
    createPwd: (size?: number | undefined) => string
    onDelete: () => void
}

const CertificateFieldItem: FC<FieldListProps> = (props) => {
    const { value, onChange, onDelete, showDelete, disabled, createPwd } = props

    const [isPassword, isUsername, isLink] = useMemo(() => {
        return [
            // 是否为密码输入框
            !!['密码', 'password', 'pwd'].find(text => value?.label.includes(text)),
            // 是否为用户名输入框
            !!['用户名', '名称', 'name'].find(text => value?.label.includes(text)),
            // 是否为链接
            !!['http://', 'https://'].find(text => value?.value.includes(text)),
        ]
    }, [value?.label, value?.value])

    const onLabelChange = (val: string) => {
        const newValue = { ...value, label: val }
        onChange?.(newValue as CertificateField)
    }

    const onValueChange = (val: string) => {
        const newValue = { ...value, value: val }
        onChange?.(newValue as CertificateField)
    }

    const onCreatePassword = () => {
        const newPassword = createPwd()
        onValueChange(newPassword)
        copy(newPassword)
        messageSuccess('新密码已复制')
    }

    const onCreateUsername = async () => {
        const resp = await getRandName()
        if (resp.code !== STATUS_CODE.SUCCESS) return
        onValueChange(resp.data || '')
        copy(resp.data || '')
        messageSuccess('新名称已复制')
    }

    const onFieldClick = () => {
        // 编辑模式下点击文本框不会复制
        if (!disabled) return

        if (!value || !value.value) {
            messageWarning('内容为空无法复制')
            return
        }

        if (isLink) {
            openNewTab(value.value)
            return
        }
        copy(value.value)
        messageSuccess('已复制' + value.label)
    }

    const MainInput = isPassword ? Input.Password : Input.TextArea

    return (
        <div className="relative w-full">
            <Input
                bordered={false}
                className={s.labelInput}
                size="small"
                value={value?.label}
                disabled={disabled}
                onChange={e => onLabelChange(e.target.value)}
            />
            <div className="flex">
                <MainInput
                    value={value?.value}
                    onChange={e => onValueChange(e.target.value)}
                    autoSize={isPassword ? undefined : { minRows: 1, maxRows: 6 }}
                ></MainInput>

                {/* 用户名生成 */}
                {!disabled && isUsername && (
                    <Button
                        className="ml-2 w-8 shrink-0 keep-antd-style !bg-sky-400"
                        type="primary"
                        icon={<GiftOutlined />}
                        onClick={onCreateUsername}
                    ></Button>
                )}

                {/* 密码生成 */}
                {!disabled && isPassword && (
                    <Button
                        className="ml-2 w-8 shrink-0 keep-antd-style !bg-sky-400"
                        type="primary"
                        icon={<GiftOutlined />}
                        onClick={onCreatePassword}
                    ></Button>
                )}

                {/* 删除按钮 */}
                {!disabled && showDelete && (
                    <Button
                        className="ml-2 w-8 shrink-0 keep-antd-style !bg-red-400"
                        icon={<CloseOutlined />}
                        type="primary"
                        onClick={onDelete}
                    ></Button>
                )}
            </div>
            
        </div>
    )
}

interface Props {
    groupId: number
    detailId: number | undefined
    onCancel: () => void
}

const getNewFormValues = () => {
    return {
        title: '新密码',
        fields: [
            {
                label: '网址',
                value: '',
            },
            {
                label: '用户名',
                value: '',
            },
            {
                label: '密码',
                value: '',
            },
        ],
    }
}

/**
 * 凭证详情
 */
export const CertificateDetail: FC<Props> = (props) => {
    const { detailId, onCancel } = props
    const [form] = Form.useForm()
    const userInfo = useAtomValue(stateUser)
    const { pwdKey, pwdIv } = useAtomValue(stateMainPwd)
    /** 新建字段时的累加字段名索引 */
    const newFieldIndex = useRef(1)
    const { mutateAsync: saveDetail, isLoading: isSaving } = useSaveCertificate(detailId)

    useEffect(() => {
        if (!detailId) return
        if (detailId === -1) {
            form.setFieldsValue(getNewFormValues())
        }
    }, [detailId])

    const createPwd = useMemo(() => {
        return customAlphabet(
            userInfo?.createPwdAlphabet ?? DEFAULT_PASSWORD_ALPHABET,
            userInfo?.createPwdLength ?? DEFAULT_PASSWORD_LENGTH,
        )
    }, [userInfo?.createPwdAlphabet, userInfo?.createPwdLength])

    const onConfirm = async () => {
        const values = await form.validateFields()
        if (!values.title) {
            messageWarning('标题不能为空')
            return
        }

        if (!pwdKey || !pwdIv) {
            messageWarning('主密码错误，请尝试重新登录')
            return
        }
        const content = aes(JSON.stringify(values.fields), pwdKey, pwdIv)

        await saveDetail({
            name: values.title,
            markColor: values.markColor,
            content,
            groupId: props.groupId,
            order: 0,
        })

        messageSuccess('保存成功')
    }

    const renderCertificateDetail = () => {
        return (
            <Form form={form}>
                <Modal
                    open={!!detailId}
                    onCancel={onCancel}
                    closable={false}
                    title={<DetailTitle disabled={false} />}
                    footer={[
                        <Button key="back" onClick={onCancel}>
                            取消
                        </Button>,
                        <Button key="submit" type="primary" onClick={onConfirm}>
                            确定
                        </Button>,
                    ]}
                >
                    {renderDetailForm()}
                </Modal>
            </Form>
        )
    }

    const renderDetailForm = () => {
        return (
            <Form.List name="fields">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map((field) => (
                            // eslint-disable-next-line react/jsx-key
                            <Form.Item
                                {...field}
                                noStyle
                            >
                                <CertificateFieldItem
                                    showDelete={fields.length > 1}
                                    createPwd={createPwd}
                                    onDelete={() => remove(field.name)}
                                />
                            </Form.Item>
                        ))}
                        <Form.Item>
                            <Button
                                type="dashed"
                                onClick={() => add({ label: '字段' + newFieldIndex.current++, value: '' })}
                                block
                                className='mt-4'
                                icon={<PlusOutlined />}
                            >
                                新增字段
                            </Button>
                        </Form.Item>
                    </>
                )}
            </Form.List>
        )
    }

    return renderCertificateDetail()
}
