import React, { FC } from 'react'
import { Button as RvButton, ButtonProps } from 'react-vant'

export const Button: FC<ButtonProps> = (props) => {
    const { className, ...otherProps } = props

    return (
        <RvButton className={'hover:opacity-75 transition !rounded-lg ' + className} {...otherProps}>
            {props.children}
        </RvButton>
    )
}
