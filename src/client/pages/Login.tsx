import { STATUS_CODE } from '@/config'
import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notify } from 'react-vant'
import { UserContext } from '../components/UserProvider'
import { setToken } from '../services/base'
import { login, requireLogin } from '../services/user'

const Register = () => {
    const { setUserProfile, setGroupList, setSelectedGroup } = useContext(UserContext)
    const navigate = useNavigate()
    const [password, setPassword] = useState('')

    // 临时功能，开发自动登录
    useEffect(() => {
        if (!password) setPassword('123')
        else onRegister()
    }, [password])

    const onRegister = async () => {
        const resp = await requireLogin().catch(error => {
            if (error.code === STATUS_CODE.NOT_REGISTER) {
                Notify.show({ type: 'danger', message: error.msg || '请先注册' })
                location.pathname = 'register.html'
            }
        })

        if (!resp) return
        const { salt, challenge } = resp
        const loginResp = await login(password, salt, challenge).catch(error => {
            Notify.show({ type: 'danger', message: error.msg || '登录失败' })
        })

        if (!loginResp) return
        const { token, defaultGroupId, groups } = loginResp

        setUserProfile({ password, token, defaultGroupId })
        setGroupList(groups)
        setSelectedGroup(defaultGroupId)
        setToken(loginResp.token)
        navigate('/group')
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