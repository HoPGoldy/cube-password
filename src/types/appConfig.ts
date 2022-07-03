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
     * 是否初始化完成
     * 为 false 的话将会被引导至注册页面
     */
    init: boolean
    /**
     * 主密码盐值
     */
    salt?: string
}
