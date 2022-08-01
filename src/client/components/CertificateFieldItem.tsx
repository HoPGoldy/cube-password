import React, { FC } from 'react'
import { CertificateField } from '@/types/app'


interface Props {
    widthClass?: string
    value?: CertificateField
    onChange?: (value: CertificateField) => void
}

const CertificateFieldItem: FC<Props> = (props) => {
    const { widthClass, value, onChange } = props

    const isPassword = !!['密码', 'password'].find(text => value?.label.includes(text))
    console.log('isPassword', isPassword)

    const onLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = { ...value, label: e.target.value }
        onChange?.(newValue as CertificateField)
    }

    const onValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = { ...value, value: e.target.value }
        onChange?.(newValue as CertificateField)
    }

    return (
        <div className={'px-4 pb-4 ' + widthClass}>
            <input
                type="text"
                value={value?.label}
                onInput={onLabelChange}
                className='mb-2 w-full'
            />
            <textarea
                value={value?.value}
                onInput={onValueChange}
                rows={1}
                className='block px-3 py-2 w-full min-h-[42px] 
                    border border-slate-300 rounded-md shadow-sm placeholder-slate-400
                    focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
            />
        </div>
    )
}

export default CertificateFieldItem