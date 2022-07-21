import React, { FC, useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { UserContext } from './UserProvider'

export const LoginAuth: FC = ({ children }) => {
    const [user] = useContext(UserContext)

    if (!user) {
        return (
            <Navigate to="/login" replace />
        )
    }

    return (
        <>{children}</>
    )
}