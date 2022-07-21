import { AppTheme } from './app'

/**
 * 后端发给前端的应用配置
 */
export interface AppConfig {
    /**
     * 应用主题
     */
    theme: AppTheme
    /**
     * 主按钮颜色
     */
    buttonColor: string
}
