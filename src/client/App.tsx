import React from 'react'
import { Routes } from './route'
import { AppConfigProvider } from './components/AppConfigProvider'
import { UserProvider } from './components/UserProvider'

function App() {
    return (
        <AppConfigProvider>
            <UserProvider>
                <Routes />
            </UserProvider>
        </AppConfigProvider>
    )
}

export default App
