import { STATUS_CODE } from '@/config'
import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notify } from 'react-vant'
import { UserContext } from '../components/UserProvider'
import { setToken } from '../services/base'
import { login, requireLogin } from '../services/user'

const Register = () => {
    const [, setUserProfile] = useContext(UserContext)
    const navigate = useNavigate()
    const [password, setPassword] = useState('')

    // 临时功能，开发自动登录
    useEffect(() => {
        if (!password) setPassword('123')
        else onRegister()
    }, [password])

    const onRegister = async () => {
        const resp = await requireLogin()
        if (resp.code !== 200 || !resp.data) {
            if (resp.code === STATUS_CODE.NOT_REGISTER) {
                Notify.show({ type: 'danger', message: resp.msg || '请先注册' })
                location.pathname = 'register.html'
            }
            return
        }

        const { salt, challenge } = resp.data
        const loginResp = await login(password, salt, challenge)
        if (loginResp.code !== 200 || !loginResp.data) {
            Notify.show({ type: 'danger', message: loginResp.msg || '登录失败' })
            return
        }

        setUserProfile({ password, token: loginResp.data.token })
        setToken(loginResp.data.token)
        navigate('/')
    }

    return (
        <div className='m-8'>
            登录页面，请输入主密码：
            <input
                autoFocus
                placeholder="请输入文本"
                value={password}
                onInput={e => setPassword((e.target as any).value)}
            />
            <Button type="primary" onClick={onRegister}>登录</Button>
        </div>
    )
}

export default Register