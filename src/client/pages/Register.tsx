import { ArrowLeft } from '@react-vant/icons'
import React, { useRef, useState } from 'react'
import { Notify, Swiper, SwiperInstance } from 'react-vant'
import { Button } from '../components/Button'
import { register } from '../services/user'

const Register = () => {
    // 副标题及介绍轮播
    const titleSwiperRef = useRef<SwiperInstance>(null)
    // 输入框轮播
    const contentSwiperRef = useRef<SwiperInstance>(null)
    // 重复密码输入框
    const repeatPasswordInputRef = useRef<HTMLInputElement>(null)
    // 密码
    const [password, setPassword] = useState('')
    // 密码错误提示
    const [pwdError, setPwdError] = useState('')
    // 重复密码
    const [repeatPassword, setRepeatPassword] = useState('')
    // 重复密码错误提示
    const [repeatPwdError, setRepeatPwdError] = useState('')

    const setSwiperIndex = (index: number) => {
        titleSwiperRef.current?.swipeTo(index)
        contentSwiperRef.current?.swipeTo(index)
    }

    const onInputedPassword = () => {
        if (password.length < 6) {
            setPwdError('密码长度应大于 6 位')
            return
        }
        setSwiperIndex(1)
        // 要延迟一会再触发下个输入框的获取焦点事件，不然会破坏轮播的滚动效果
        setTimeout(() => {
            repeatPasswordInputRef.current?.focus()
        }, 600)
    }

    const onInputedRepeatPassword = () => {
        if (repeatPassword !== password) {
            setRepeatPwdError('两次密码不一致')
            return
        }
        setSwiperIndex(2)
    }

    const onSubmit = async () => {
        await register(password)
        Notify.show({ type: 'success', message: '初始化完成' })

        // 开发模式下页面没有经过后台代理，所以需要手动跳转到登录页
        if (process.env.NODE_ENV === 'development') location.pathname = '/'
        // 生产环境下注册页和登录页的路由时一样的，并且有随机前缀，所以直接刷新页面就行
        else location.reload()
    }

    return (
        <div className="h-screen w-screen bg-background flex flex-col justify-center items-center">
            <header className="text-center w-4/5 mb-16 flex flex-col items-center">
                <div className="text-5xl font-bold text-mainColor">应用初始化</div>
                <div className="mt-4 text-xl text-mainColor">
                    <Swiper
                        ref={titleSwiperRef}
                        indicator={false}
                        touchable={false}
                    >
                        <Swiper.Item key={0}>
                            设置主密码
                            <div className='text-slate-600 text-base mt-6'>
                                主密码是访问应用的唯一凭证，请设置一个至少 6 位的强密码，并牢记在心。
                                <br /><br />
                                不要使用生日、姓名缩写等常见信息。
                            </div>
                        </Swiper.Item>
                        <Swiper.Item key={1}>
                            重复密码
                            <div className='text-slate-600 text-base mt-6'>
                                隐私数据将使用该密码加密。因此，主密码一旦丢失，所有的数据都将 <b>无法找回</b>。
                            </div>
                        </Swiper.Item>
                        <Swiper.Item key={2}>
                            告知
                            <div className='text-slate-600 text-base mt-6'>
                                本应用不会在任何地方使用、分析或明文存储你的信息。
                                <br /><br />
                                你可以使用浏览器的隐私模式进行访问来提高安全性。
                                <br /><br />
                                该页面不会再次出现，请确保 <b>主密码已可靠保存</b> 后点击下方按钮。
                            </div>
                        </Swiper.Item>
                    </Swiper>
                </div>
            </header>
            <div className='w-[90%] md:w-1/2 lg:w-1/3'>
                <Swiper
                    ref={contentSwiperRef}
                    indicator={false}
                    touchable={false}
                >
                    <Swiper.Item key={0}>
                        <div className='py-8 px-2 flex items-center relative'>
                            <input
                                type='password'
                                className={
                                    'block grow mr-2 px-3 py-2 transition ' +
                                    'border rounded-md shadow-sm placeholder-slate-400 border-slate-300 ' +
                                    'focus:outline-none focus:bg-white  ' +
                                    (pwdError ? 'focus:ring-1 focus:border-red-500 focus:ring-red-500 border-red-500' : 'focus:ring-1 focus:border-sky-500 focus:ring-sky-500')
                                }
                                autoFocus
                                placeholder="请输入主密码"
                                value={password}
                                onChange={e => {
                                    setPassword(e.target.value)
                                    if (pwdError) setPwdError('')
                                    if (repeatPwdError) setRepeatPwdError('')
                                    if (repeatPassword) setRepeatPassword('')
                                }}
                                onKeyUp={e => {
                                    if (e.key === 'Enter') onInputedPassword()
                                }}
                            />

                            {pwdError && <div className='absolute text-sm bottom-1 text-red-500'>
                                {pwdError}    
                            </div>}

                            <Button
                                disabled={!password}
                                className='shrink-0'
                                type='primary'
                                onClick={onInputedPassword}
                            >下一步</Button>
                        </div>
                    </Swiper.Item>
                    <Swiper.Item key={1}>
                        <div>
                            <div className={'pt-8 px-2 flex items-center relative ' + (repeatPwdError ? 'pb-8' : 'pb-4')}>
                                <input
                                    ref={repeatPasswordInputRef}
                                    type='password'
                                    className={
                                        'block grow mr-2 px-3 py-2 transition ' +
                                        'border rounded-md shadow-sm placeholder-slate-400 border-slate-300 ' +
                                        'focus:outline-none focus:bg-white  ' +
                                        (repeatPwdError ? 'focus:ring-1 focus:border-red-500 focus:ring-red-500 border-red-500' : 'focus:ring-1 focus:border-sky-500 focus:ring-sky-500')
                                    }
                                    placeholder="重复主密码"
                                    value={repeatPassword}
                                    onChange={e => {
                                        setRepeatPassword(e.target.value)
                                        if (repeatPwdError) setRepeatPwdError('')
                                    }}
                                    onKeyUp={e => {
                                        if (e.key === 'Enter') onInputedRepeatPassword()
                                    }}
                                />

                                {repeatPwdError && <div className='absolute text-sm bottom-1 text-red-500'>
                                    {repeatPwdError}    
                                </div>}

                                <Button
                                    disabled={!repeatPassword}
                                    className='shrink-0'
                                    type='primary'
                                    onClick={onInputedRepeatPassword}
                                >下一步</Button>
                            </div>
                            <div
                                className='
                                    flex items-center justify-center w-24 mx-auto py-1 pl-1 pr-2 rounded transition cursor-pointer
                                    text-slate-700
                                    hover:bg-slate-300
                                '
                                onClick={() => setSwiperIndex(0)}
                            ><ArrowLeft className='inline mr-2' />返回</div>
                        </div>
                    </Swiper.Item>
                    <Swiper.Item key={2}>
                        <div>
                            <div className='pt-8 pb-4 px-2'>
                                <Button type='primary' block onClick={onSubmit}>完成初始化</Button>
                            </div>
                            <div
                                className='
                                    flex items-center justify-center w-24 mx-auto py-1 pl-1 pr-2 rounded transition cursor-pointer
                                    text-slate-700 hover:bg-slate-300
                                '
                                onClick={() => setSwiperIndex(1)}
                            ><ArrowLeft className='inline mr-2' />返回</div>
                        </div>
                    </Swiper.Item>
                </Swiper>
            </div>
        </div>
    )
}

export default Register