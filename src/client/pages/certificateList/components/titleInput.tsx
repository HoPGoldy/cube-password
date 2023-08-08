import React, { FC } from 'react'
import { Input } from 'antd'
import s from '../styles.module.css'

interface Props {
    value?: string
    disabled?: boolean
    onChange?: (value: string) => void
}

export const TitleInput: FC<Props> = (props) => {
    const { value, onChange, disabled } = props

    return (
        <Input
            type="text"
            value={value}
            disabled={disabled}
            onChange={e => onChange?.(e.target.value)}
            placeholder="请输入密码名"
            bordered={false}
            className={`font-bold dark:text-slate-200 text-xl pl-0 ${s.labelInput}`}
        />
    )
}
