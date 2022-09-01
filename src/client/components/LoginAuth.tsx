import React, { FC, useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { routePrefix } from '../constans'
import { UserContext } from './UserProvider'

export const LoginAuth: FC = ({ children }) => {
    const { userProfile } = useContext(UserContext)

    if (!userProfile) {
        return (
            <Navigate to={routePrefix + '/login'} replace />
        )
    }

    return (
        <>{children}</>
    )
}