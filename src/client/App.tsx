import React from 'react'
import { Routes } from './route'
import { AppConfigProvider } from './components/AppConfigProvider'
import { UserProvider } from './components/UserProvider'
import { GroupProvider } from './components/GroupProvider'
import { ConfigProvider } from 'react-vant'

const themeVars = {
    buttonBorderRadius: 'var(--rv-border-radius-lg)',
    buttonDefaultHeight: '38px'
}

function App() {
    return (
        <ConfigProvider themeVars={themeVars}>
            <AppConfigProvider>
                <UserProvider>
                    <GroupProvider>
                        <Routes />
                    </GroupProvider>
                </UserProvider>
            </AppConfigProvider>
        </ConfigProvider>
    )
}

export default App
