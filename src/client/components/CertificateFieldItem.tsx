import React, { FC, useState } from 'react'
import { CertificateField } from '@/types/app'
import { Clear, Eye, ClosedEye } from '@react-vant/icons'


interface Props {
    widthClass?: string
    showDelete?: boolean
    value?: CertificateField
    onChange?: (value: CertificateField) => void
    onDelete?: () => void
}

const CertificateFieldItem: FC<Props> = (props) => {
    const { widthClass, value, onChange, showDelete = true, onDelete } = props
    const [hiddenPassword, setHiddenPassword] = useState(true)

    const isPassword = !!['密码', 'password'].find(text => value?.label.includes(text))

    const onLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = { ...value, label: e.target.value }
        onChange?.(newValue as CertificateField)
    }

    const onValueChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        const newValue = { ...value, value: e.target.value }
        onChange?.(newValue as CertificateField)
    }

    return (
        <div className={'px-4 pb-4 relative ' + widthClass}>
            <input
                type="text"
                value={value?.label}
                onInput={onLabelChange}
                className='mb-2 w-full'
            />
            {
                isPassword ?
                    <input
                        type={hiddenPassword ? 'password' : 'text'}
                        value={value?.value}
                        onChange={onValueChange}
                        className='block px-3 py-2 w-full min-h-[42px] 
                            border border-slate-300 rounded-md shadow-sm placeholder-slate-400
                            focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    /> :
                    <textarea
                        value={value?.value}
                        onChange={onValueChange}
                        rows={1}
                        className='block px-3 py-2 w-full min-h-[42px] 
                            border border-slate-300 rounded-md shadow-sm placeholder-slate-400
                            focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    />
            }
            {isPassword && (hiddenPassword ?
                <Eye className='absolute right-14 top-11 cursor-pointer' fontSize={18} onClick={() => setHiddenPassword(false)} /> :
                <ClosedEye className='absolute right-14 top-11 cursor-pointer' fontSize={18} onClick={() => setHiddenPassword(true)} />
            )}

            {showDelete && <Clear
                className='absolute right-6 top-11 cursor-pointer text-red-400'
                fontSize={18}
                onClick={onDelete}
            />}
        </div>
    )
}

export default CertificateFieldItem