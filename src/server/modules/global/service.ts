import { AppConfig } from '@/types/appConfig'
import { AppStorage, AppTheme } from '@/types/app'

interface Props {
    mainColor: string[]
    saveStorage: () => Promise<void>
    updateAppStorage: (data: Partial<AppStorage>) => Promise<void>
}

export const createService = (props: Props) => {
    const { mainColor, updateAppStorage, saveStorage } = props

    /**
     * 获取当前应用全局配置
     */
    const getAppConfig = (): AppConfig => {
        const randIndex = Math.floor(Math.random() * (mainColor.length))
        const buttonColor = mainColor[randIndex]

        return { buttonColor }
    }

    /**
     * 设置应用主题色
     */
    const setTheme = async (theme: AppTheme) => {
        await updateAppStorage({ theme })
        saveStorage()
    }

    return { getAppConfig, setTheme }
}

export type GlobalService = ReturnType<typeof createService>