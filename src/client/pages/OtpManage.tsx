import { aes, getAesMeta, sha } from '@/utils/crypto'
import React, { useContext, useState } from 'react'
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from '../Route'
import Header from '../components/Header'
import { Field } from '../components/Field'
import { changePwd, fetchOtpInfo, registerOtp, requireChangePwd } from '../services/user'
import { validateAesMeta } from '@/utils/crypto'
import { ChangePasswordData } from '@/types/http'
import { setToken } from '../services/base'
import { useQuery } from 'react-query'

interface ChangePwdForm {
    oldPwd: string
    newPwd: string
    passwordConfirm: string
}

const ChangePassword = () => {
    const { setUserProfile, userProfile } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const [form] = Form.useForm<ChangePwdForm>()
    const [initCode, setInitCode] = useState('')
    const navigate = useNavigate()
    const { data: otpInfo, isLoading: isLoadingOtpInfo, refetch: refetchOtpInfo } = useQuery('fetchOtpInfo', fetchOtpInfo, {
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })
    console.log('otpInfo', otpInfo)

    const onSubmit = async () => {
        if (!initCode || initCode.length !== 6) {
            Notify.show({ type: 'warning', message: '请输入正确的验证码' })
            return
        }
        await registerOtp(initCode)
        refetchOtpInfo()
    }

    const renderContent = () => {
        if (isLoadingOtpInfo || !otpInfo) {
            return (
                <div className='text-center'>正在加载中...</div>
            )
        }

        if (!otpInfo.registered) {
            return (<>
                <div className='w-full flex justify-center flex-col md:flex-row rounded-lg py-4 px-6 bg-white dark:bg-slate-700 dark:text-slate-200'>
                    <img src={otpInfo?.qrCode} />
                    <div>
                        <div className='mt-4 cursor-default leading-7'>
                            请使用谷歌身份验证器扫描二维码，扫描完成后将会以
                            <code className='bg-slate-200 dark:bg-slate-600 rounded p-1 overflow-auto mx-2'>keep-my-passord(main password)</code>
                            显示。
                        </div>
                        <div className='my-2 cursor-default text-slate-500'>
                            没有身份验证器？
                            <a className='text-sky-500' href='https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2' target='__blank'>点此安装</a>
                        </div>
                        <Field
                            placeholder="请输入身份验证器提供的 6 位验证码"
                            onChange={setInitCode}
                            value={initCode}
                            onKeyUp={e => {
                                if (e.key === 'Enter') onSubmit()
                            }}
                        />
                    </div>
                </div>

                <div className='hidden md:block mt-6'>
                    <Button block onClick={onSubmit} color={config?.buttonColor}>
                    绑定
                    </Button>
                </div>

                <div className='w-full text-center text-gray-500 dark:text-gray-400 mt-6 cursor-default text-sm'>
                    绑定后将会在重要操作时请求身份验证器提供的验证码，以保证您的账户安全。
                </div>
            </>)
        }

        return (
            <div className='w-full flex justify-center items-center flex-col md:flex-row rounded-lg py-4 px-6 bg-white dark:bg-slate-700 dark:text-slate-200'>
                <div className='text-7xl'>🎉</div>
                <div className='md:block mt-6'>
                    <div>绑定成功</div>
                    <Button block onClick={onSubmit}>
                        解除绑定
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    谷歌令牌管理
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 mt-4'>
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