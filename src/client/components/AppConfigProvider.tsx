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
                ? (<Loading className="my-24 dark:!text-gray-200" size="36px" vertical>
                    <span className='dark:text-gray-200'>加载中...</span>
                </Loading>)
                : props.children
            }
        </AppConfigContext.Provider>
    )
}