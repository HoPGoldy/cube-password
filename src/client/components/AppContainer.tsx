import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export const AppContainer = () => {
    return (
        <div className='flex'>
            <aside className='h-screen w-sidebar hidden md:block'>
                <Sidebar />
            </aside>
            <main className='h-screen w-page-content flex-grow'>
                <Outlet />
            </main>
        </div>
    )
}