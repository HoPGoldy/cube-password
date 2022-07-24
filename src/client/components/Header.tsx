import React, { FC } from 'react'

interface Props {
    className?: string
    style?: React.CSSProperties
}

const Header: FC<Props> = (props) => {
    return (
        <div className={'font-bold text-lg bg-white rounded-lg py-2 px-4 ' + props.className} style={props.style}>
            {props.children}
        </div>
    )
}

export default Header