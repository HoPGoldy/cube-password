import React, { ChangeEventHandler, FC, useEffect, useRef, useState } from 'react'

interface Props {
    className?: string
    value?: string
    disabled?: boolean
    onChange: ChangeEventHandler<HTMLTextAreaElement>
}

/**
 * 支持自适应高度的 textarea
 */
const Textarea: FC<Props> = (props) => {
    const { className, value, disabled, onChange } = props
    const [textareaHeight, setTextareaHeight] = useState(42)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (!textareaRef.current) return
        setTextareaHeight(textareaRef.current.scrollHeight)
    }, [value])

    return (
        <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={onChange}
            rows={1}
            style={{ height: textareaHeight + 'px' }}
            className={'min-h-[42px] overflow-hidden ' + className}
        />
    )
}

export default Textarea