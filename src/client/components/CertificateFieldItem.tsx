import React, { FC, useState } from 'react'
import { CertificateField } from '@/types/app'
import { Cross, Eye, GiftO, ClosedEye, Description } from '@react-vant/icons'
import Textarea from './Textarea'
import { IconBaseProps } from '@react-vant/icons/es/IconBase'
import copy from 'copy-to-clipboard'
import { createPwd } from '@/utils/createPassword'
import { Notify } from 'react-vant'

interface Props {
    showDelete?: boolean
    value?: CertificateField
    disabled?: boolean
    onChange?: (value: CertificateField) => void
    onDelete?: () => void
}

const fieldClass = `
block grow px-3 py-2 w-full transition 
border border-slate-300 rounded-md shadow-sm placeholder-slate-400 
focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500
`

const enableClass = `
bg-slate-100 hover:bg-white
`

interface IconButtonProps {
    Icon: (props: Omit<IconBaseProps, 'name'>) => JSX.Element
    className: string
    onClick?: () => unknown
}

const CertificateFieldItem: FC<Props> = (props) => {
    const { disabled, value, onChange, showDelete = true, onDelete } = props
    const [hiddenPassword, setHiddenPassword] = useState(true)

    const isPassword = !!['密码', 'password'].find(text => value?.label.includes(text))

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
        Notify.show({ type: 'success', message: '新密码已复制' })
    }

    const onCopy = () => {
        if (!value || !value.value) {
            Notify.show({ type: 'warning', message: '内容为空无法复制' })
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
        <div className={'px-4 pb-4 relative w-full lg:w-[50%] 2xl:w-[50%]'}>
            <input
                type="text"
                value={value?.label}
                disabled={disabled}
                onChange={e => onLabelChange(e.target.value)}
                className='mb-2 w-full disabled:bg-white'
            />
            <div className='flex items-start'>
                {isPassword ?
                    <input
                        type={hiddenPassword ? 'password' : 'text'}
                        value={value?.value}
                        disabled={disabled}
                        onChange={e => onValueChange(e.target.value)}
                        className={'min-h-[42px] ' + fieldClass + (disabled ? 'disabled:bg-white' : enableClass)}
                    /> :
                    <Textarea
                        value={value?.value}
                        onChange={e => onValueChange(e.target.value)}
                        disabled={disabled}
                        className={fieldClass + (disabled ? 'disabled:bg-white' : enableClass)}
                    />
                }

                {isPassword && (hiddenPassword ?
                    renderIconButton({ Icon: Eye, className: 'bg-purple-400 ring-purple-500', onClick: () => setHiddenPassword(false) }) :
                    renderIconButton({ Icon: ClosedEye, className: 'bg-purple-400 ring-purple-500', onClick: () => setHiddenPassword(true) })
                )}

                {disabled && renderIconButton({ Icon: Description, className: 'bg-green-400 ring-green-500', onClick: onCopy })}

                {!disabled && isPassword && renderIconButton({ Icon: GiftO, className: 'bg-sky-400 ring-sky-500', onClick: onCreatePassword })}

                {!disabled && showDelete && renderIconButton({ Icon: Cross, className: 'bg-red-400 ring-red-500', onClick: onDelete })}
            </div>
        </div>
    )
}

export default CertificateFieldItem