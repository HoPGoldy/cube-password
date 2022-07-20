import sha512 from 'crypto-js/sha512'

export const sha = (str: string) => {
    return sha512(str).toString().toUpperCase()
}

export const hasLokiObj = <T extends Record<any, any>>(obj: T): obj is T & LokiObj => {
    if (typeof obj !== 'object') return false
    if (!('$loki' in obj && typeof obj.$loki === 'string')) return false
    if (!('meta' in obj) || typeof obj.meta !== 'object') return false

    return true
}

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