import React, { FC, useState, useMemo } from 'react'
import { CertificateField } from '@/types/app'
import { Cross, Eye, GiftO, ClosedEye } from '@react-vant/icons'
import Textarea from './Textarea'
import { IconBaseProps } from '@react-vant/icons/es/IconBase'
import copy from 'copy-to-clipboard'
import { Notify } from 'react-vant'
import { getRandName } from '../services/certificate'
import { openNewTab } from '@/utils/common'

interface Props {
    showDelete?: boolean
    value?: CertificateField
    disabled?: boolean
    onChange?: (value: CertificateField) => void
    createPwd: (size?: number | undefined) => string
    onDelete?: () => void
}

const fieldClass = `
block px-3 py-2 w-full transition 
border border-slate-300 dark:border-slate-500 dark:text-gray-200 rounded-md shadow-sm placeholder-slate-400 
focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500
`

const enableClass = `
bg-slate-100 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 dark:text-gray-200
`

interface IconButtonProps {
    Icon: (props: Omit<IconBaseProps, 'name'>) => JSX.Element
    className: string
    onClick?: () => unknown
}

const CertificateFieldItem: FC<Props> = (props) => {
    const { disabled, value, onChange, showDelete = true, onDelete, createPwd } = props
    const [hiddenPassword, setHiddenPassword] = useState(true)

    const [isPassword, isUsername, isLink] = useMemo(() => {
        return [
            // 是否为密码输入框
            !!['密码', 'password', 'pwd'].find(text => value?.label.includes(text)),
            // 是否为用户名输入框
            !!['用户名', '名称', 'name'].find(text => value?.label.includes(text)),
            // 是否为链接
            value?.value.startsWith('http://') || value?.value.startsWith('https://')
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
        console.log(123321, createPwd)
        const newPassword = createPwd()
        console.log('卡死', createPwd)
        onValueChange(newPassword)
        copy(newPassword)
        Notify.show({ type: 'success', message: '新密码已复制' })
    }

    const onCreateUsername = async () => {
        const resp = await getRandName()
        onValueChange(resp)
        copy(resp)
        Notify.show({ type: 'success', message: '新名称已复制' })
    }

    const onFieldClick = () => {
        // 编辑模式下点击文本框不会复制
        if (!disabled) return

        if (!value || !value.value) {
            Notify.show({ type: 'warning', message: '内容为空无法复制' })
            return
        }

        if (isLink) {
            openNewTab(value.value)
            return
        }
        copy(value.value)
        Notify.show({ type: 'success', message: '已复制' + value.label })
    }

    // 渲染输入框后面的小按钮
    const renderIconButton = (buttonProps: IconButtonProps) => {
        const { Icon, className, onClick } = buttonProps
        return (
            <div
                className={
                    'ml-2 my-1 h-[34px] w-[34px] flex justify-center items-center rounded-lg shrink-0 ' +
                    'hover:ring active:scale-90 transition cursor-pointer select-none ' +
                    className
                }
                onClick={onClick}
            >
                <Icon color='white' fontSize={24} />
            </div>
        )
    }

    return (
        <div className={'px-4 pb-4 relative w-full'}>
            <input
                type="text"
                value={value?.label}
                disabled={disabled}
                onChange={e => onLabelChange(e.target.value)}
                className='mb-2 w-full disabled:bg-white dark:disabled:bg-slate-600 dark:bg-slate-600 dark:text-gray-200'
            />
            <div className='flex items-start'>
                <div onClick={onFieldClick} className='w-full grow ring-slate-300 active:ring rounded-lg transition'>
                    {isPassword ?
                        <input
                            type={hiddenPassword ? 'password' : 'text'}
                            value={value?.value}
                            disabled={disabled}
                            onChange={e => onValueChange(e.target.value)}
                            className={'min-h-[42px] ' + fieldClass + (disabled ? 'disabled:bg-white dark:disabled:bg-slate-600' : enableClass)}
                        /> :
                        <Textarea
                            value={value?.value}
                            onChange={e => onValueChange(e.target.value)}
                            disabled={disabled}
                            className={
                                fieldClass +
                                (disabled ? 'disabled:bg-white dark:disabled:bg-slate-600' : enableClass) +
                                ((isLink && disabled) ? ' cursor-pointer text-sky-500' : '')
                            }
                        />
                    }
                </div>

                {isPassword && (hiddenPassword ?
                    renderIconButton({ Icon: Eye, className: 'bg-purple-400 ring-purple-500', onClick: () => setHiddenPassword(false) }) :
                    renderIconButton({ Icon: ClosedEye, className: 'bg-purple-400 ring-purple-500', onClick: () => setHiddenPassword(true) })
                )}

                {!disabled && isPassword && renderIconButton({ Icon: GiftO, className: 'bg-sky-400 ring-sky-500', onClick: onCreatePassword })}

                {!disabled && isUsername && renderIconButton({ Icon: GiftO, className: 'bg-sky-400 ring-sky-500', onClick: onCreateUsername })}

                {!disabled && showDelete && renderIconButton({ Icon: Cross, className: 'bg-red-400 ring-red-500', onClick: onDelete })}
            </div>
        </div>
    )
}

export default CertificateFieldItem