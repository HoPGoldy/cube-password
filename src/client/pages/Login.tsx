import { STATUS_CODE } from '@/config'
import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notify } from 'react-vant'
import { UserContext } from '../components/UserProvider'
import { login, requireLogin } from '../services/user'

const Register = () => {
    const [, setUserProfile] = useContext(UserContext)
    const navigate = useNavigate()
    const [password, setPassword] = useState('')

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

        Notify.show({ type: 'success', message: '登录成功' })
        setUserProfile(loginResp.data)
        navigate('/')
    }

    return (
        <div>
            登录页面，请输入主密码：
            <input
                placeholder="请输入文本"
                value={password}
                onInput={e => setPassword((e.target as any).value)}
            />
            <Button type="primary" onClick={onRegister}>登录</Button>
        </div>
    )
}

export default Register