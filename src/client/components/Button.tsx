import React, { FC } from 'react'
import { Button as RvButton, ButtonProps } from 'react-vant'

export const Button: FC<ButtonProps> = (props) => {
    return (
        <RvButton className={'hover:opacity-75 transition ' + props.className} {...props}>
            {props.children}
        </RvButton>
    )
}
