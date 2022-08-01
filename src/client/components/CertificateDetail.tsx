import { Delete, AddO } from '@react-vant/icons'
import React, { FC, useContext } from 'react'
import { Form, Overlay } from 'react-vant'
import { Button } from '@/client/components/Button'
import { AppConfigContext } from './AppConfigProvider'
import CertificateFieldItem from './CertificateFieldItem'

interface Props {
    visible: boolean
    onClose: () => void
}

const CertificateDetail: FC<Props> = (props) => {
    const { visible, onClose } = props
    const [config] = useContext(AppConfigContext)

    const onFinish = (values: any) => {
        console.log(values)
    }

    return (
        <Overlay visible={visible} duration={100}>
            <div className='overflow-y-auto h-screen flex items-center justify-center'>
                <div className='bg-slate-200 p-4 mx-4 rounded-lg w-[60vw] my-10'>
                    <input
                        type="text"
                        value='新密码'
                        className='font-bold text-xl bg-inherit mb-4'
                    />
                    <Form onFinish={onFinish} className='rounded-lg bg-white pt-4 flex flex-row flex-wrap'>
                        <Form.List name="fields" initialValue={[{ label: '密码', value: '123321' }]}>
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map((field, idx) => {
                                        return (
                                            <Form.Item
                                                key={idx}
                                                customField
                                                name={[field.name]}
                                            >
                                                <CertificateFieldItem widthClass={idx === 0 ? 'w-full' : 'w-[50%]'} />
                                            </Form.Item>
                                        )
                                    })}
                                    <div className='mx-4 pt-2 pb-4'>
                                        <Button plain className='!border-slate-300' block icon={<AddO />} onClick={() => add({ label: '字段' + fields.length, value: '' })}>
                                            新增字段
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form.List>
                    </Form>

                    <div className='flex flex-col md:flex-row'>
                        <Button className='!mt-4 md:!mr-4 md:w-[50%]' block onClick={onClose}>
                            放弃
                        </Button>
                        <Button className='!mt-4 md:w-[50%]' color={config?.buttonColor} block>
                            提交
                        </Button>
                    </div>
                </div>
            </div>
        </Overlay>
    )
}

export default CertificateDetail