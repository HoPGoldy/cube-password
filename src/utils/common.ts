/**
 * 将 loki 存储对象中的相关元数据擦除，并设置 id
 */
export const replaceLokiInfo = <T>(item: Record<any, any>): T & { id: number } => {
    const newItem: any = {
        id: item.$loki,
        ...item
    }

    delete newItem.meta
    delete newItem.$loki
    return newItem as T & { id: number }
}

/**
 * 把后端存储的区域字符串转换为阅读友好形式
 */
export const formatLocation = (location?: string) => {
    if (!location) return '未知地点'
    return location.split('|').filter(str => str !== '0').join(', ')
}

/**
 * 获取服务开放端口
 */
export const getServePort = () => {
    const portArg = process.argv.slice(2).find(arg => arg.startsWith('--port'))
    const userPort = Number(portArg?.replace('--port=', ''))

    if (userPort) return userPort
    // 开发环境默认端口
    if (process.env.NODE_ENV === 'development') return 3600
    // 生产环境默认端口
    else return 3700
}