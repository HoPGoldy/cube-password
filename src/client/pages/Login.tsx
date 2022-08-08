import { STATUS_CODE } from '@/config'
import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notify } from 'react-vant'
import { AppConfigContext } from '../components/AppConfigProvider'
import { Button } from '../components/Button'
import { UserContext } from '../components/UserProvider'
import { setToken } from '../services/base'
import { login, requireLogin } from '../services/user'

const Register = () => {
    const { setUserProfile, setGroupList, setSelectedGroup } = useContext(UserContext)
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const config = useContext(AppConfigContext)

    // 临时功能，开发自动登录
    useEffect(() => {
        if (!password) setPassword('123456')
        else onSubmit()
    }, [password])

    const onSubmit = async () => {
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
        <div className="h-screen w-screen bg-background flex flex-col justify-center items-center">
            <header className="w-screen text-center mb-36 ">
                <div className="text-5xl font-bold text-mainColor">密码本</div>
                <div className="mt-4 text-xl text-mainColor">管理任何需要加密的内容</div>
            </header>
            <div className='md:w-1/3 flex items-center'>
                <input
                    className='
                        block grow mr-2 px-3 py-2 w-full transition 
                        border border-slate-300 rounded-md shadow-sm placeholder-slate-400 
                        focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500
                    '
                    autoFocus
                    placeholder="请输入主密码"
                    value={password}
                    onInput={e => setPassword((e.target as any).value)}
                    onKeyUp={e => {
                        if (e.key === 'Enter') onSubmit()
                    }}
                />
                <Button
                    className='shrink-0'
                    color={config?.buttonColor}
                    onClick={onSubmit}
                >登 录</Button>
            </div>
        </div>
    )
}

export default Register