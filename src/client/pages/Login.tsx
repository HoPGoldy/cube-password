import { STATUS_CODE } from '@/config'
import { LoginSuccessResp } from '@/types/user'
import { sha } from '@/utils/crypto'
import { Button, Input, InputRef } from 'antd'
import React, { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useLogin } from '../services/user'
import { useAppDispatch, useAppSelector } from '../store'
import { login } from '../store/user'
import { messageError, messageSuccess } from '../utils/message'
import { UserOutlined, KeyOutlined } from '@ant-design/icons'
import { PageTitle } from '../components/pageTitle'
import { queryChallengeCode } from '../services/global'

const Register = () => {
    const dispatch = useAppDispatch()
    /** 密码 */
    const [password, setPassword] = useState('')
    /** 密码输入框 */
    const passwordInputRef = useRef<InputRef>(null)
    /** 应用配置 */
    const config = useAppSelector(s => s.global.appConfig)
    /** 提交登录 */
    const { mutateAsync: postLogin, isLoading: isLogin } = useLogin()
    /** 动态验证码 */
    const [code, setCode] = useState('')
    /** 验证码输入框 */
    const codeInputRef = useRef<HTMLInputElement>(null)
    /** 是否显示动态验证码输入框 */
    const [codeVisible, setCodeVisible] = useState(false)
    /** store 里的用户信息 */
    const userInfo = useAppSelector(s => s.user.userInfo)

    const onSubmit = async () => {
        if (!password) {
            messageError('请输入密码')
            passwordInputRef.current?.focus()
            return
        }

        const challengeResp = await queryChallengeCode()
        if (challengeResp.code !== STATUS_CODE.SUCCESS) return

        // const resp = await postLogin({ username, password: sha(password) })
        // if (resp.code !== STATUS_CODE.SUCCESS) return

        // messageSuccess('登录成功，欢迎回来。')
        // const userInfo = resp.data as LoginSuccessResp
        // dispatch(login(userInfo))
    }

    if (userInfo) {
        return <Navigate to="/" replace />
    }

    return (
        <div className="h-screen w-screen bg-gray-100 flex flex-col justify-center items-center dark:text-gray-100">
            <PageTitle title='登录' />
            <header className="w-screen text-center min-h-[236px]">
                <div className="text-5xl font-bold text-mainColor">{config?.appName}</div>
                <div className="mt-4 text-xl text-mainColor">{config?.loginSubtitle}</div>
            </header>
            <div className='w-[70%] md:w-[40%] lg:w-[30%] xl:w-[20%] flex flex-col items-center'>
                <Input.Password
                    size='large'
                    className='mb-2'
                    ref={passwordInputRef}
                    placeholder="请输入密码"
                    prefix={<KeyOutlined />}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyUp={e => {
                        if (e.key === 'Enter') onSubmit()
                    }}
                />

                <Button
                    size='large'
                    block
                    disabled={isLogin}
                    type="primary"
                    style={{ background: config?.buttonColor }}
                    onClick={onSubmit}
                >登 录</Button>
            </div>
        </div>
    )
}

export default Register