import React, { FC, useContext, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { routePrefix } from '../constans'
import { UserContext } from './UserProvider'
import { getToken, setToken } from '../services/base'

export const useLogout = () => {
    const { setUserProfile, setSelectedGroup, setNoticeInfo, setGroupList } = useContext(UserContext)

    /**
     * 统一登出方法
     * 会清除所有的数据
     */
    return () => {
        setUserProfile(undefined)
        setSelectedGroup(0)
        setNoticeInfo(undefined)
        setGroupList([])
        setToken(null)
    }
}

export const LoginAuth: FC = ({ children }) => {
    const { userProfile } = useContext(UserContext)
    const logout = useLogout()
    const token = getToken()

    useEffect(() => {
        if (token) return
        logout()
    }, [token])

    if (!userProfile) {
        return (
            <Navigate to={routePrefix + '/login'} replace />
        )
    }

    return (
        <>{children}</>
    )
}