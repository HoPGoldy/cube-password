import React, { useContext, useState, useImperativeHandle, forwardRef, ForwardRefRenderFunction, useRef } from 'react'
import { Lock } from '@react-vant/icons'
import { Button } from './Button'
import { AppConfigContext } from './AppConfigProvider'
import { setToken } from '../services/base'
import { unlockGroup, requireOperate } from '../services/certificateGroup'
import { UserContext } from './UserProvider'

export interface GroupUnlockRef {
    unlock: () => void
}

const GroupLogin: ForwardRefRenderFunction<GroupUnlockRef> = (_, ref) => {
    const config = useContext(AppConfigContext)
    const [password, setPassword] = useState('')
    const passwordInputRef = useRef<HTMLInputElement>(null)
    const { setUserProfile, selectedGroup, refetchCertificateList } = useContext(UserContext)

    const onUnlock = async () => {
        const resp = await requireOperate(selectedGroup)
        const { salt, challenge } = resp

        const loginResp = await unlockGroup(selectedGroup, password, salt, challenge).catch(() => {
            passwordInputRef.current?.focus()
            setPassword('')
        })
        if (!loginResp) return
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
            <Lock fontSize={98} className='text-slate-400 dark:text-slate-200' />
            <span className='inline-block mt-4 mb-6 text-slate-500 dark:text-slate-200'>该分组已加密</span>
            <div className='w-[80%] md:w-full flex items-center'>
                <input
                    ref={passwordInputRef}
                    type='password'
                    className='
                        block grow px-3 py-2 w-full transition dark:bg-slate-700 dark:text-gray-200
                        border border-slate-300 dark:border-slate-500 rounded-md shadow-sm placeholder-slate-400 
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