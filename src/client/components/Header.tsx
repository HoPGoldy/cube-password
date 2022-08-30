import React, { FC } from 'react'

interface Props {
    className?: string
    style?: React.CSSProperties
}

const Header: FC<Props> = (props) => {
    return (
        <div
            className={
                'bg-white dark:bg-slate-700 dark:text-gray-200 flex flex-nowrap select-none items-center transition ' +
                'm-4 mb-0 p-2 text-lg text-center rounded-lg justify-center ' +
                'md:m-0 md:p-4 md:h-[71px] md:text-left md:justify-start md:rounded-none md:border-b md:border-gray-300 md:dark:border-gray-800 ' + props.className
            }
            style={props.style}
        >
            {props.children}
        </div>
    )
}

export default Header