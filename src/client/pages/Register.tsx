import { ArrowLeft } from '@react-vant/icons'
import React, { useRef, useState } from 'react'
import { Notify, Swiper, SwiperInstance } from 'react-vant'
import { Button } from '../components/Button'
import { register } from '../services/user'

const Register = () => {
    const titleSwiperRef = useRef<SwiperInstance>(null)
    const contentSwiperRef = useRef<SwiperInstance>(null)
    const [password, setPassword] = useState('')

    const setSwiperIndex = (index: number) => {
        titleSwiperRef.current?.swipeTo(index)
        contentSwiperRef.current?.swipeTo(index)
    }

    const onSubmit = async () => {
        // await register(password)
        Notify.show({ type: 'success', message: '注册成功' })
        // location.pathname = ''
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
                            <div className='text-slate-600 text-base mt-4'>
                                主密码是访问应用的唯一凭证，请设置一个至少 6 位的强密码，并牢记在心。
                                <br /><br />
                                不要使用生日、姓名缩写等常见信息。
                            </div>
                        </Swiper.Item>
                        <Swiper.Item key={1}>
                            重复密码
                            <div className='text-slate-600 text-base mt-4'>
                                隐私数据将使用该密码加密。因此，主密码一旦丢失，所有的数据都将 <b>无法找回</b>。
                            </div>
                        </Swiper.Item>
                        <Swiper.Item key={2}>
                            告知
                            <div className='text-slate-600 text-base mt-4'>
                                本应用不会在任何地方明文存储你的信息。
                                <br /><br />
                                你可以使用浏览器的隐私模式进行访问来提高安全性。
                                <br /><br />
                                该页面不会再次出现，请确保 <b>主密码已可靠保存</b> 后点击我确定。
                            </div>
                        </Swiper.Item>
                    </Swiper>
                </div>
            </header>
            <div className='w-[90%] md:w-1/2'>
                <Swiper
                    ref={contentSwiperRef}
                    indicator={false}
                    touchable={false}
                >
                    <Swiper.Item key={0}>
                        <div className='py-8 px-2 flex items-center'>
                            <input
                                className='
                                    block grow mr-2 px-3 py-2 transition 
                                    border border-slate-300 rounded-md shadow-sm placeholder-slate-400 
                                    focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500
                                '
                                autoFocus
                                placeholder="请输入主密码"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyUp={e => {
                                    if (e.key === 'Enter') setSwiperIndex(1)
                                }}
                            />
                            <Button
                                className='shrink-0'
                                type='primary'
                                onClick={() => setSwiperIndex(1)}
                            >下一步</Button>
                        </div>
                    </Swiper.Item>
                    <Swiper.Item key={1}>
                        <div>
                            <div className='pt-8 pb-4 px-2 flex items-center'>
                                <input
                                    className='
                                        block grow mr-2 px-3 py-2 transition 
                                        border border-slate-300 rounded-md shadow-sm placeholder-slate-400 
                                        focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500
                                    '
                                    placeholder="请重复主密码"
                                    value={password}
                                    onInput={e => setPassword((e.target as any).value)}
                                    onKeyUp={e => {
                                        if (e.key === 'Enter') onSubmit()
                                    }}
                                />
                                <Button
                                    className='shrink-0'
                                    type='primary'
                                    onClick={() => setSwiperIndex(2)}
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
                                <Button type='primary' block onClick={onSubmit}>我确定</Button>
                            </div>
                            <div
                                className='
                                    flex items-center justify-center w-24 mx-auto py-1 pl-1 pr-2 rounded transition cursor-pointer
                                    text-slate-700
                                    hover:bg-slate-300
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