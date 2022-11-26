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
 * 判断两个位置字符串是否为同一区域
 * 由于最后一位是网络提供商（例如电信、移动），所以需要剔除
 */
export const isSameLocation = (location1?: string, location2?: string) => {
    if (!location1 || !location2) return false
    return location1.split('|').slice(0, 3).join('|') === location2.split('|').slice(0, 3).join('|')
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

/**
 * 打开一个新标签页
 * 因为 window.open 会被浏览器拦截，打开多个标签页的话，老的标签页会被新的替换掉
 * 导致最多只能打开一个新标签页，所以需要用这种方式来打开多个标签页
 */
export const openNewTab = (href: string) => {
    const a = document.createElement('a')
    a.setAttribute('href', href)
    a.setAttribute('target', '_blank')
    a.setAttribute('id', 'startTelMedicine')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}