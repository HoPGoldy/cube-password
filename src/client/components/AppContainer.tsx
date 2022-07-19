import React, { FC, useContext } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { UserContext } from './UserProvider'

export const AppContainer: FC = () => {
    const [user] = useContext(UserContext)

    if (!user) {
        return (
            <Navigate to="/login" replace />
        )
    }

    return (
        <div className="w-screen text-center mt-10">
            <nav className='mb-4 text-blue-600'>
                <Link to="/" className="mr-4">Home</Link>
                <Link to="/requestDemo" className="mr-4">Request</Link>
            </nav>

            <Outlet />
        </div>
    )
}