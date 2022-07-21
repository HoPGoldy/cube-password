import React from 'react'
import { Routes } from './route'
import { AppConfigProvider } from './components/AppConfigProvider'
import { UserProvider } from './components/UserProvider'
import { GroupProvider } from './components/GroupProvider'

function App() {
    return (
        <AppConfigProvider>
            <UserProvider>
                <GroupProvider>
                    <Routes />
                </GroupProvider>
            </UserProvider>
        </AppConfigProvider>
    )
}

export default App
