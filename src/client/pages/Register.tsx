import React, { useState } from 'react'
import { Button, Notify } from 'react-vant'
import { register } from '../services/user'

const Register = () => {
    const [password, setPassword] = useState('')

    const onRegister = async () => {
        await register(password)
        Notify.show({ type: 'success', message: '注册成功' })
        location.pathname = ''
    }

    return (
        <div>
            注册页面，请输入主密码：
            <input
                placeholder="请输入文本"
                value={password}
                onInput={e => setPassword((e.target as any).value)}
            />
            <Button type="primary" onClick={onRegister}>注册</Button>
        </div>
    )
}

export default Register