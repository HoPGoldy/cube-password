import React, { FC } from 'react'
import { fetchAppConfig } from '../services/user'
import { AppConfig } from '@/types/appConfig'
import { useQuery } from 'react-query'

export const AppConfigContext = React.createContext<AppConfig | undefined>(undefined)

export const AppConfigProvider: FC = (props) => {
    const { data: appConfig, isLoading: isLoadingConfig } = useQuery('appConfig', fetchAppConfig)

    return (
        <AppConfigContext.Provider value={appConfig}>
            {isLoadingConfig ? <div>Loading...</div> : props.children}
        </AppConfigContext.Provider>
    )
}