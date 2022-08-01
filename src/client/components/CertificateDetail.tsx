import React, { FC, useContext, useRef, useState } from 'react'
import { Form, Overlay, Dialog, hooks } from 'react-vant'
import { Question, Plus } from '@react-vant/icons'
import { Button } from '@/client/components/Button'
import { AppConfigContext } from './AppConfigProvider'
import CertificateFieldItem from './CertificateFieldItem'
import { CertificateField } from '@/types/app'

const { useClickAway } = hooks

interface Props {
    visible: boolean
    onClose: () => void
}

const defaultFields: CertificateField[] = [
    { label: '密码', value: '' },
    { label: '网址', value: '' }
]

const CertificateDetail: FC<Props> = (props) => {
    const { visible, onClose } = props
    const [config] = useContext(AppConfigContext)
    const [title, setTitle] = useState('新密码')
    const [form] = Form.useForm()
    const newFieldIndex = useRef(1)
    const dialogRef = useRef<HTMLDivElement>(null)

    const onFinish = () => {
        console.log(form.getFieldsValue())
    }

    const onConfirmClose = async () => {
        await Dialog.confirm({
            message: '确定要关闭吗？未保存的内容都将丢失',
            confirmButtonText: '关闭',
            confirmButtonColor: '#ef4444'
        })
        onClose()
    }

    useClickAway(dialogRef, (e) => {
        // 由于点击显示弹窗的按钮也会触发 useClickAway
        // 所以这里要判断下只有点击 div 元素时才会触发关闭确认
        if ((e.target as HTMLDivElement).tagName !== 'DIV') return
        onConfirmClose()
    })

    return (
        <Overlay visible={visible} duration={100} className='overflow-y-auto'>
            <div className='flex justify-center'>
                <div ref={dialogRef} className='bg-slate-200 relative p-4 mx-4 my-10 rounded-lg w-screen md:w-[80vw] lg:w-[60vw] xl:w-[40%]'>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className='font-bold text-xl bg-inherit mb-4'
                    />
                    <div className='absolute cursor-default top-5 right-5 flex items-center text-gray-500'>
                        <Question className='mr-2' /> 标题名和字段名均可修改
                    </div>
                    <Form form={form} className='rounded-lg bg-white pt-4'>
                        <Form.List name="fields" initialValue={defaultFields}>
                            {(fields, { add, remove }) => (<>
                                <div className='flex flex-row flex-wrap'>
                                    {fields.map((field, idx) => {
                                        return (
                                            <Form.Item
                                                key={idx}
                                                customField
                                                name={[field.name]}
                                            >
                                                <CertificateFieldItem
                                                    widthClass={idx === 0 ? 'w-full' : 'w-full md:w-[50%]'}
                                                    showDelete={fields.length > 1}
                                                    onDelete={() => remove(idx)}
                                                />
                                            </Form.Item>
                                        )
                                    })}
                                </div>
                                <div className='mx-4 pt-4 pb-6'>
                                    <Button
                                        plain
                                        className='!border-slate-300'
                                        block
                                        icon={<Plus />}
                                        onClick={() => add({ label: '字段' + newFieldIndex.current++, value: '' })}
                                    >
                                        新增字段
                                    </Button>
                                </div>
                            </>)}
                        </Form.List>
                    </Form>

                    <div className='flex flex-row justify-between'>
                        <Button className='!mt-4 md:!mr-4 !w-[20%] md:!w-[50%]' onClick={onConfirmClose}>
                            返回
                        </Button>
                        <Button className='!mt-4 !w-[75%] md:!w-[50%]' color={config?.buttonColor} onClick={onFinish}>
                            提交
                        </Button>
                    </div>
                </div>
            </div>
        </Overlay>
    )
}

export default CertificateDetail