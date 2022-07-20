import React, { FC, useContext } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { UserContext } from './UserProvider'

export const LoginAuth: FC = () => {
    const [user] = useContext(UserContext)

    if (!user) {
        return (
            <Navigate to="/login" replace />
        )
    }

    return (
        <Outlet />
    )
}