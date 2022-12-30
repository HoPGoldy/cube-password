import { aes, getAesMeta, sha } from '@/utils/crypto'
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
import { changePwd, fetchOtpInfo, requireChangePwd } from '../services/user'
import { validateAesMeta } from '@/utils/crypto'
import { ChangePasswordData } from '@/types/http'
import { setToken } from '../services/base'
import { useQuery } from 'react-query'

interface ChangePwdForm {
    oldPwd: string
    newPwd: string
    passwordConfirm: string
    code?: string
}

const ChangePassword = () => {
    const { setUserProfile, userProfile } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const [form] = Form.useForm<ChangePwdForm>()
    const navigate = useNavigate()
    // 加载当前令牌信息
    const { data: otpInfo, isLoading: isLoadingOtpInfo } = useQuery('fetchOtpInfo', fetchOtpInfo, {
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })

    const onSubmit = async () => {
        if (!userProfile) {
            Notify.show({ type: 'danger', message: '用户信息解析错误，请重新登录' })
            return
        }

        const { oldPwd, newPwd, code } = await form.validateFields()
        if (!validateAesMeta(oldPwd, userProfile.pwdKey, userProfile.pwdIv)) {
            Notify.show({ type: 'warning', message: '旧密码不正确' })
            return
        }

        if (validateAesMeta(newPwd, userProfile.pwdKey, userProfile.pwdIv)) {
            Notify.show({ type: 'warning', message: '新密码不得与旧密码重复' })
            return
        }

        // 获取修改密码挑战码
        const challengeCode = await requireChangePwd()

        const postKey = sha(userProfile.pwdSalt + oldPwd) + challengeCode + userProfile.token
        const { key, iv } = getAesMeta(postKey)

        const postData: ChangePasswordData = { oldPwd, newPwd, code }
        const encryptedData = aes(JSON.stringify(postData), key, iv)

        await changePwd(encryptedData)

        Notify.show({ type: 'success', message: '密码更新成功' })
        setUserProfile(undefined)
        setToken(null)
        navigate('/login', { replace: true })
    }

    const validatePassword = async (_: any, value: string) => {
        if (value && value.length >= 6) return
        throw new Error('请输入至少六位密码!')
    }

    const validateRepeatPassword = async (_: any, value: string) => {
        const pwd = form.getFieldValue('password')
        if (!pwd || value === pwd) return
        throw new Error('两次输入密码不一致!')
    }

    const renderContent = () => {
        if (isLoadingOtpInfo) return (
            <div className='text-center'>载入中...</div>
        )
        return (<>
            <Form form={form} className='rounded-lg py-4 px-6 bg-white dark:bg-slate-700 dark:text-slate-200'>
                <Form.Item
                    name="oldPwd"
                    label="原主密码"
                    rules={[{ required: true, message: '请输入原主密码' }]}
                    labelClass='w-28'
                    customField
                >
                    <Field type='password' />
                </Form.Item>
                <Form.Item
                    name="newPwd"
                    label="新主密码"
                    customField
                    rules={[{ required: true, validator: validatePassword }]}
                    labelClass='w-28'
                >
                    <Field type='password' />
                </Form.Item>
                <Form.Item
                    name="passwordConfirm"
                    validateTrigger="onChange"
                    customField
                    label="重复新主密码"
                    rules={[{ required: false, validator: validateRepeatPassword }]}
                    labelClass='w-28'
                >
                    <Field type='password' />
                </Form.Item>
                {otpInfo?.registered && 
                <Form.Item
                    name="code"
                    customField
                    label="动态验证码"
                    rules={[{ required: true, message: '请输入动态验证码' }]}
                    labelClass='w-28'
                >
                    <Field type='password' />
                </Form.Item>}
            </Form>

            <div className='hidden md:block mt-6'>
                <Button block onClick={onSubmit} color={config?.buttonColor}>
                    提交
                </Button>
            </div>

            <div className='w-full text-center text-gray-500 dark:text-gray-400 mt-6 cursor-default text-sm'>
                请确保新的分组密码已牢记<br />
                更新后所有的凭证都将使用新密码重新加密
            </div>
        </>)
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    密码修改
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 2xl:w-1/3 mt-4'>
                    {renderContent()}
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={onSubmit}>更新主密码</ActionButton>
            </PageAction>
        </div>
    )
}

export default ChangePassword