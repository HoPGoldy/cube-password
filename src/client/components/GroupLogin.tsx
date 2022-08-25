import React, { useContext, useState, useImperativeHandle, forwardRef, ForwardRefRenderFunction } from 'react'
import { Lock } from '@react-vant/icons'
import { Button } from './Button'
import { AppConfigContext } from './AppConfigProvider'
import { setToken } from '../services/base'
import { login, requireLogin } from '../services/certificateGroup'
import { UserContext } from './UserProvider'

export interface GroupUnlockRef {
    unlock: () => void
}

const GroupLogin: ForwardRefRenderFunction<GroupUnlockRef> = (_, ref) => {
    const config = useContext(AppConfigContext)
    const [password, setPassword] = useState('')
    const { setUserProfile, selectedGroup, refetchCertificateList } = useContext(UserContext)

    const onUnlock = async () => {
        const resp = await requireLogin(selectedGroup)
        const { salt, challenge } = resp

        const loginResp = await login(selectedGroup, password, salt, challenge)
        const { token } = loginResp

        setUserProfile(old => {
            if (!old) return old
            return { ...old, token }
        })
        setToken(loginResp.token)
        refetchCertificateList()
    }

    useImperativeHandle(ref, () => ({ unlock: onUnlock }))

    return (
        <div className='w-full md:w-2/5 mt-16 mx-auto flex flex-col justify-center items-center'>
            <Lock fontSize={98} className='text-slate-400' />
            <span className='inline-block mt-4 mb-6 text-slate-500'>该分组已加密</span>
            <div className='w-[80%] md:w-full flex items-center'>
                <input
                    type='password'
                    className='
                        block grow px-3 py-2 w-full transition 
                        border border-slate-300 rounded-md shadow-sm placeholder-slate-400 
                        focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500
                    '
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyUp={e => {
                        if (e.key === 'Enter') onUnlock()
                    }}
                    placeholder='请输入分组密码'
                ></input>
                <Button
                    className='!hidden md:!block !ml-2 w-16 shrink-0'
                    color={config?.buttonColor}
                    onClick={onUnlock}
                >解锁</Button>
            </div>
        </div>
    )
}

export default forwardRef(GroupLogin)