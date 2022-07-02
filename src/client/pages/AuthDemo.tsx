import React, { useState, useContext } from 'react'
import { UserContext } from '../components/UserProvider'
import { setToken } from '../services/base'
import { fetchUserInfo, login } from '../services/user'

const RequestDemo = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loginResp, setLoginResp] = useState('')
    const [infoResp, setInfoResp] = useState('')
    const [userInfo, setUserInfo] = useContext(UserContext)

    const getUserInfo = async () => {
        const resp = await fetchUserInfo()
        setInfoResp(JSON.stringify(resp))
    }

    const onLogin = async () => {
        setLoginResp('')
        const { data, code, msg } = await login(username, password)
        if (code !== 200) {
            setLoginResp(msg || '登录失败')
            return
        }
        setUserInfo(data)
        data?.token && setToken(data?.token)
        setInfoResp('')
    }

    const onLogout = () => {
        setToken('')
        setUserInfo(undefined)
        setInfoResp('')
        setUsername('')
        setPassword('')
    }

    return (
        <div className="m-auto w-[600px] text-left">
            {userInfo ? (
                <button
                    className="py-2 px-4 bg-blue-500 rounded-lg text-white w-full"
                    onClick={onLogout}
                >登出</button>
            ) : (<>
                <div className="flex flex-row">
                    <input
                        value={username}
                        onInput={e => setUsername((e.target as HTMLInputElement).value)}
                        placeholder="用户名 user"
                        className="py-2 px-4 mr-2 bg-gray-200 rounded-lg"
                    />
                    <input
                        value={password}
                        onInput={e => setPassword((e.target as HTMLInputElement).value)}
                        placeholder="密码 password"
                        className="py-2 px-4 mr-2 bg-gray-200 rounded-lg"
                    />
                    <button onClick={onLogin} className="py-2 px-4 bg-blue-500 rounded-lg text-white flex-grow">登录</button>
                </div>
                {loginResp && <div className='mt-4 text-red-500'>{loginResp}</div>}
            </>)}

            <button className="py-2 px-4 mt-4 bg-blue-500 rounded-lg text-white w-full" onClick={getUserInfo}>请求用户信息</button>
            {infoResp && <div className="py-2 px-4 mt-4 bg-gray-200 rounded-lg">响应：{infoResp}</div>}
        </div>
    )
}

export default RequestDemo