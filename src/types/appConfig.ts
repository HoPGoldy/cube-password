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
    /**
     * 登录错误的日期数组
     */
    loginFailure: string[]
    /**
     * 应用是否被锁定
     */
    appLock: boolean
    /**
     * 应用是被被无限期锁定
     */
    appFullLock: boolean
}
