import React, { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import { fetchAppConfig } from '../services/user'
import { AppConfig } from '@/types/appConfig'
import { Notify } from 'react-vant'

export const AppConfigContext = React.createContext<[
    AppConfig | undefined,
    Dispatch<SetStateAction<AppConfig | undefined>>
]>([undefined, () => console.error('AppConfigContext is not initialized')])

export const AppConfigProvider: FC = (props) => {
    const [appConfig, setAppConfig] = useState<AppConfig>()

    useEffect(() => {
        const initAppConfig = async () => {
            const resp = await fetchAppConfig()
            if (resp.code !== 200 || !resp.data) {
                Notify.show({ type: 'danger', message: resp.msg || '获取配置失败' })
                return
            }
            setAppConfig(resp.data)
        }

        initAppConfig()
    }, [])

    return (
        <AppConfigContext.Provider value={[appConfig, setAppConfig]}>
            {props.children}
        </AppConfigContext.Provider>
    )
}