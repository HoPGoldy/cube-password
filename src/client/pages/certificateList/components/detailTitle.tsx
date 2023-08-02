import React, { FC } from 'react'
import { Form } from 'antd'
import { TitleInput } from './titleInput'

interface Props {
    disabled: boolean
}

export const DetailTitle: FC<Props> = (props) => {
    const { disabled } = props

    return (
        <div className='w-100'>
            <Form.Item noStyle name='title'>
                <TitleInput disabled={disabled} />
            </Form.Item>
        </div>
    )
}
