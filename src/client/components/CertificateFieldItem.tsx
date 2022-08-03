import React, { FC, useState } from 'react'
import { CertificateField } from '@/types/app'
import { Cross, Eye, GiftO, ClosedEye } from '@react-vant/icons'
import Textarea from './Textarea'
import { IconBaseProps } from '@react-vant/icons/es/IconBase'
import copy from 'copy-to-clipboard'
import { createPwd } from '@/utils/createPassword'
import { Notify } from 'react-vant'

interface Props {
    showDelete?: boolean
    value?: CertificateField
    onChange?: (value: CertificateField) => void
    onDelete?: () => void
}

interface IconButtonProps {
    Icon: (props: Omit<IconBaseProps, 'name'>) => JSX.Element
    className: string
    onClick?: () => unknown
}

const CertificateFieldItem: FC<Props> = (props) => {
    const { value, onChange, showDelete = true, onDelete } = props
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

    // 渲染输入框后面的小按钮
    const renderIconButton = (buttonProps: IconButtonProps) => {
        const { Icon, className, onClick } = buttonProps
        return (
            <div className={
                'ml-2 my-1 h-[34px] w-[34px] flex justify-center items-center rounded-lg shrink-0 ' +
                'hover:ring active:scale-90 transition cursor-pointer ' +
                className
            }>
                <Icon color='white' fontSize={24} onClick={onClick} />
            </div>
        )
    }

    return (
        <div className={'px-4 pb-4 relative w-full lg:w-[50%] 2xl:w-[50%]'}>
            <input
                type="text"
                value={value?.label}
                onChange={e => onLabelChange(e.target.value)}
                className='mb-2 w-full'
            />
            <div className='flex items-start'>
                {isPassword ?
                    <input
                        type={hiddenPassword ? 'password' : 'text'}
                        value={value?.value}
                        onChange={e => onValueChange(e.target.value)}
                        className='block grow px-3 py-2 w-full min-h-[42px] 
                            border border-slate-300 rounded-md shadow-sm placeholder-slate-400
                            focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    /> :
                    <Textarea
                        value={value?.value}
                        onChange={e => onValueChange(e.target.value)}
                        className='block grow px-3 py-2 w-full 
                            border border-slate-300 rounded-md shadow-sm placeholder-slate-400
                            focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    />
                }

                {isPassword && (hiddenPassword ?
                    renderIconButton({ Icon: Eye, className: 'bg-purple-400 ring-purple-500', onClick: () => setHiddenPassword(false) }) :
                    renderIconButton({ Icon: ClosedEye, className: 'bg-purple-400 ring-purple-500', onClick: () => setHiddenPassword(true) })
                )}

                {isPassword && renderIconButton({ Icon: GiftO, className: 'bg-sky-400 ring-sky-500', onClick: onCreatePassword })}

                {showDelete && renderIconButton({ Icon: Cross, className: 'bg-red-400 ring-red-500', onClick: onDelete })}
            </div>
        </div>
    )
}

export default CertificateFieldItem