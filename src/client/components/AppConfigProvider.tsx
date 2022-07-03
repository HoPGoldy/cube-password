import React, { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import { fetchAppConfig } from '../services/user'
import { AppConfig } from '@/types/appConfig'

export const AppConfigContext = React.createContext<[
    AppConfig | undefined,
    Dispatch<SetStateAction<AppConfig | undefined>>
]>([undefined, () => console.error('AppConfigContext is not initialized')])

export const AppConfigProvider: FC = (props) => {
    const [appConfig, setAppConfig] = useState<AppConfig>()

    const initAppConfig = async () => {
        const resp = await fetchAppConfig()
        console.log('resp', resp)
    }

    useEffect(() => {
        initAppConfig()
    }, [])

    return (
        <AppConfigContext.Provider value={[appConfig, setAppConfig]}>
            {props.children}
        </AppConfigContext.Provider>
    )
}