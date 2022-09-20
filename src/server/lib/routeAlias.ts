interface AliasConfig {
    route: string
    alias: string
    method: string
}

/**
 * 给路由项配置别名
 * 让日志查看时更清晰
 */
export const createRouteAlias = () => {
    const getterCache: Record<string, string> = {}
    const aliasConfigs: AliasConfig[] = []

    const setAlias = (route: string, alias: string, method = 'GET') => {
        aliasConfigs.push({ route, alias, method })
        return route
    }

    const getAlias = (route: string, method: string) => {
        const key = `${route}|${method}`
        if (getterCache[key]) return getterCache[key]

        const config = aliasConfigs.find(item => {
            if (item.method !== method) return false
            return route.endsWith(item.route)
        })

        getterCache[key] = config ? config.alias : route

        return getterCache[key]
    }

    return { setAlias, getAlias }
}

export type SetAliasFunc = ReturnType<typeof createRouteAlias>['setAlias']

export type GetAliasFunc = ReturnType<typeof createRouteAlias>['getAlias']
