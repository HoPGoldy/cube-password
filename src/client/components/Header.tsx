import React, { FC } from 'react'

interface Props {
    className?: string
    style?: React.CSSProperties
}

const Header: FC<Props> = (props) => {
    const baseClass = 'bg-white flex flex-nowrap select-none items-center'
    const smClass = 'm-4 p-2 text-lg text-center rounded-lg justify-center'
    const mdClass = 'md:m-0 md:p-4 md:h-[71px] md:text-left md:justify-start md:rounded-none md:border-b md:border-gray-300'
    return (
        <div className={[baseClass, smClass, mdClass, props.className || ''].join(' ')} style={props.style}>
            {props.children}
        </div>
    )
}

export default Header