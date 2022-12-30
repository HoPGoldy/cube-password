import React, { useContext } from 'react'
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Field } from '../components/Field'
import { setCreatePwdSetting } from '../services/user'
import { CreatePwdSettingData } from '@/types/http'
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH } from '@/constants'

const CreatePwdSetting = () => {
    const { setUserProfile, userProfile } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const [form] = Form.useForm<CreatePwdSettingData>()
    const navigate = useNavigate()

    const onSubmit = async () => {
        if (!userProfile) {
            Notify.show({ type: 'danger', message: '用户信息解析错误，请重新登录' })
            return
        }

        const { pwdAlphabet, pwdLength } = await form.validateFields()
        await setCreatePwdSetting(pwdAlphabet, +pwdLength)

        Notify.show({ type: 'success', message: '密码生成规则已更新' })
        setUserProfile(old => {
            if (!old) return old
            return { ...old, createPwdAlphabet: pwdAlphabet, createPwdLength: +pwdLength }
        })
        navigate(-1)
    }

    const onReset = async () => {
        await setCreatePwdSetting('', 0)

        Notify.show({ type: 'success', message: '密码生成规则已重置' })
        setUserProfile(old => {
            if (!old) return old
            return { ...old, createPwdAlphabet: DEFAULT_PASSWORD_ALPHABET, createPwdLength: DEFAULT_PASSWORD_LENGTH }
        })
        form.setFieldsValue({ pwdAlphabet: DEFAULT_PASSWORD_ALPHABET, pwdLength: DEFAULT_PASSWORD_LENGTH })
    }

    const validateNumber = async (_: any, value: string) => {
        if (Number.isNaN(+value)) {
            throw new Error('请输入数字')
        }
        if (parseInt(value) !== +value) {
            throw new Error('请输入整数')
        }
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    新密码生成规则
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 2xl:w-1/3 mt-4'>
                    <Form
                        form={form}
                        className='rounded-lg py-4 px-6 bg-white dark:bg-slate-700 dark:text-slate-200'
                        initialValues={{
                            pwdAlphabet: userProfile?.createPwdAlphabet || DEFAULT_PASSWORD_ALPHABET,
                            pwdLength: userProfile?.createPwdLength || DEFAULT_PASSWORD_LENGTH,
                        }}
                    >
                        <Form.Item
                            name="pwdAlphabet"
                            label="密码字符集"
                            customField
                            rules={[{ required: true, message: '请填写字符集' }]}
                            labelClass='w-28'
                        >
                            <Field />
                        </Form.Item>
                        <Form.Item
                            name="pwdLength"
                            validateTrigger="onChange"
                            customField
                            label="密码长度"
                            rules={[{ required: true, validator: validateNumber }]}
                            labelClass='w-28'
                        >
                            <Field />
                        </Form.Item>
                    </Form>

                    <div className='hidden md:block mt-6'>
                        <Button block onClick={onSubmit} color={config?.buttonColor}>
                            提交
                        </Button>
                    </div>

                    <div className='mt-4 md:mt-2'>
                        <Button block onClick={onReset}>
                            重置
                        </Button>
                    </div>

                    <div className='w-full text-center text-gray-500 dark:text-gray-400 mt-6 cursor-default text-sm'>
                        生成新密码时将从字符集中随机挑选<br />
                        点击重置按钮可以将生成规则重置为默认值，不会影响已生成的密码
                    </div>
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={onSubmit}>保存</ActionButton>
            </PageAction>
        </div>
    )
}

export default CreatePwdSetting