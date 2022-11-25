import React, { FC, KeyboardEventHandler } from 'react'

interface FieldProps {
  type?: 'text' | 'password'
  value?: string
  label?: string
  placeholder?: string
  error?: boolean
  errorMessage?: string
  onChange?: (value: string) => void
  onKeyUp?: KeyboardEventHandler<HTMLInputElement>
  labelClass?: string
}

export const Field: FC<FieldProps> = (props) => {
    const { type = 'text', label, value, onChange, error, errorMessage, labelClass = '', onKeyUp, placeholder } = props

    const colorClass = error
        ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        : 'border-slate-300 dark:border-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'

    return (
        <div className='flex flex-col md:flex-row md:items-center grow'>
            {label && <span className={'mr-4 md:text-right ' + labelClass}>{label}</span>}
            <div className='grow'>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange && onChange(e.target.value)}
                    placeholder={placeholder}
                    onKeyUp={onKeyUp}
                    className={'block px-3 py-2 min-h-[42px] my-2 w-full bg-slate-100 dark:text-gray-200 dark:bg-slate-600 hover:bg-white hover:dark:bg-slate-500 transition ' +
                      'border border-solid rounded-md shadow-sm placeholder-slate-400 ' +
                      'focus:outline-none focus:bg-white ' + colorClass}
                />
                {error && <div className='text-red-500 text-sm'>{errorMessage}</div>}
            </div>
        </div>
    )
}