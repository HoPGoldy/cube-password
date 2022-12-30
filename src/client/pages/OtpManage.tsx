import React, { useContext, useState, useEffect } from 'react'
import { Notify, Popup } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Field } from '../components/Field'
import { fetchOtpInfo, registerOtp, removeOtp } from '../services/user'
import { useQuery } from 'react-query'

const ChangePassword = () => {
    const navigate = useNavigate()
    const config = useContext(AppConfigContext)
    // 绑定验证码内容
    const [initCode, setInitCode] = useState('')
    // 解绑验证码内容
    const [removeCode, setRemoveCode] = useState('')
    // 是否显示解绑弹窗
    const [removeVisible, setRemoveVisible] = useState(false)
    // 请求是否进行中
    const [submiting, setSubmiting] = useState(false)
    // 二维码是否已失效
    const [isInvalid, setIsInvalid] = useState(false)
    // 加载当前令牌信息
    const { data: otpInfo, isLoading: isLoadingOtpInfo, refetch: refetchOtpInfo } = useQuery('fetchOtpInfo', fetchOtpInfo, {
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })

    // 二维码到了之后设置过期倒计时
    useEffect(() => {
        setIsInvalid(false)
        if (!otpInfo || otpInfo.registered) {
            return
        }

        const invalidTimer = setTimeout(() => {
            setIsInvalid(true)
        }, 1000 * 60 * 5)

        return () => {
            clearTimeout(invalidTimer)
        }
    }, [otpInfo])

    const onSubmit = async () => {
        if (!initCode || initCode.length !== 6) {
            Notify.show({ type: 'warning', message: '请输入正确的验证码' })
            return
        }

        setSubmiting(true)
        registerOtp(initCode)
            .then(() => {
                Notify.show({ type: 'success', message: '绑定成功' })
            })
            .finally(() => {
                refetchOtpInfo()
                setSubmiting(false)
                setInitCode('')
                setRemoveCode('')
            })
    }

    const onRemove = async () => {
        if (!removeCode || removeCode.length !== 6) {
            Notify.show({ type: 'warning', message: '请输入正确的验证码' })
            return
        }

        setSubmiting(true)
        removeOtp(removeCode)
            .then(() => {
                Notify.show({ type: 'success', message: '解绑成功' })
            })
            .finally(() => {
                refetchOtpInfo()
                setSubmiting(false)
                setInitCode('')
                setRemoveCode('')
            })
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
                    <div className='relative flex justify-center items-center'>
                        <img src={otpInfo?.qrCode} />
                        {isInvalid &&
                        <div className='absolute inset-0 bg-white dark:bg-slate-700 opacity-90 flex justify-center items-center'>
                            <div className='text-center dark:text-slate-200 cursor-pointer' onClick={() => refetchOtpInfo()}>
                                二维码已失效<br />点此刷新
                            </div>
                        </div>}
                    </div>
                    <div className='mt-4 md:ml-4 md:mt-2'>
                        <div className='cursor-default leading-7'>
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
                    <Button block onClick={onSubmit} loading={submiting} color={config?.buttonColor}>
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
                <div className='text-7xl m-4'>🎉</div>
                <div className='w-full'>
                    <div className='text-center font-bold mb-2 text-green-500'>令牌验证已启用</div>
                    <div className='text-center mb-4'>应用将会在异地登录、修改主密码，重置分组密码时请求令牌验证</div>
                    <Button block onClick={() => setRemoveVisible(true)} loading={submiting}>
                        解除绑定
                    </Button>
                </div>
                <Popup
                    round
                    className='w-[90%] md:w-1/2'
                    visible={removeVisible}
                    onClose={() => setRemoveVisible(false)}
                >
                    <div className='p-6'>
                        <div className='flex items-center'>
                            <Field
                                placeholder="请输入 6 位验证码"
                                onChange={setRemoveCode}
                                value={removeCode}
                                onKeyUp={e => {
                                    if (e.key === 'Enter') onRemove()
                                }}
                            />
                            <Button className='shrink-0 !ml-2' onClick={onRemove} color={config?.buttonColor} loading={submiting}>
                                解除绑定
                            </Button>
                        </div>
                        <div className='mt-2 text-slate-500 text-center dark:text-slate-300'>
                            解除绑定会导致安全性降低，请谨慎操作。
                        </div>
                    </div>
                </Popup>
            </div>
        )
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    动态验证码管理
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 mt-4'>
                    {renderContent()}
                </div>
            </PageContent>

            <PageAction>
                {!otpInfo?.registered && (
                    <ActionIcon onClick={() => navigate(-1)}>
                        <ArrowLeft fontSize={24} />
                    </ActionIcon>
                )}
                <ActionButton onClick={otpInfo?.registered ? () => navigate(-1) : onSubmit} loading={submiting}>
                    {otpInfo?.registered ? '返回' : '绑定令牌'}
                </ActionButton>
            </PageAction>
        </div>
    )
}

export default ChangePassword