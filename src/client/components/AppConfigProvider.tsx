import React, { FC } from 'react'
import { fetchAppConfig } from '../services/user'
import { AppConfig } from '@/types/appConfig'
import { useQuery } from 'react-query'
import { Loading } from 'react-vant'

export const AppConfigContext = React.createContext<AppConfig | undefined>(undefined)

export const AppConfigProvider: FC = (props) => {
    const { data: appConfig, isLoading: isLoadingConfig } = useQuery('appConfig', fetchAppConfig, {
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })

    return (
        <AppConfigContext.Provider value={appConfig}>
            {isLoadingConfig 
                ? <Loading className="my-24" size="36px" vertical>加载中...</Loading>
                : props.children
            }
        </AppConfigContext.Provider>
    )
}