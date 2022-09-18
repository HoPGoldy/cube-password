import lokijs from 'lokijs'
import { ensureDir } from 'fs-extra'
import { AppStorage, AppTheme, CertificateDetail, CertificateGroup, HttpRequestLog, SecurityNotice, SecurityNoticeType } from '@/types/app'
import { STORAGE_PATH } from '@/config'

/**
 * 全局的 loki 实例缓存
 */
const lokiInstances: Record<string, lokijs> = {}

/**
 * 获取全局 loki 存储实例
 */
export const getLoki = async (name = 'storage'): Promise<lokijs> => {
    if (lokiInstances[name]) return lokiInstances[name]

    await ensureDir(STORAGE_PATH)

    return new Promise(resolve => {
        lokiInstances[name] = new lokijs(`${STORAGE_PATH}/${name}.json`, {
            autoload: true,
            autosave: true,
            autosaveInterval: 1000 * 60 * 60 * 24,
            autoloadCallback: () => resolve(lokiInstances[name])
        })
    })
}

/**
 * 保存数据到本地
 */
export const saveLoki = async (name = 'storage'): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!lokiInstances) return resolve()

        lokiInstances[name].saveDatabase(err => {
            if (err) reject(err)
            resolve()
        })
    })
}

interface CreateAccessorArgs<T> {
    lokiName?: string
    collectionName: string,
    initOption?: Partial<CollectionOptions<T>>,
    initData?: T[]
}

/**
 * 创建集合访问器
 * @param collectionName 集合名
 * @returns 一个 async 函数，调用后返回对应的集合
 */
export const createCollectionAccessor = <T extends Record<string | number, any>>(arg: CreateAccessorArgs<T>) => {
    const { lokiName, collectionName, initData, initOption } = arg

    return async () => {
        const loki = await getLoki(lokiName)
        const collection = loki.getCollection<T>(collectionName)
        if (collection) return collection

        const newCollection = loki.addCollection<T>(collectionName, initOption)
        if (initData) newCollection.insert(initData)
        return newCollection
    }
}

const getAppStorageCollection = createCollectionAccessor<AppStorage>({
    collectionName: 'global'
})

const getDefaultAppStorage = (): AppStorage => {
    return { theme: AppTheme.Light, defaultGroupId: 1, initTime: Date.now() }
}

/**
 * 获取应用全局数据
 */
export const getAppStorage = async () => {
    const collection = await getAppStorageCollection()
    return collection.data[0] || collection.insert(getDefaultAppStorage())
}

/**
 * 更新应用全局数据
 */
export const updateAppStorage = async (newStorage: Partial<AppStorage>) => {
    const collection = await getAppStorageCollection()

    const oldStorage = collection.data[0] || collection.insert(getDefaultAppStorage())
    const fullStorage = { ...oldStorage, ...newStorage }
    collection.update(fullStorage)
}

/**
 * 获取日志集合
 */
export const getLogCollection = createCollectionAccessor<HttpRequestLog>({
    lokiName: 'log',
    collectionName: 'requestLog',
    initOption: {
        // 只保存近一个月的日志
        ttl: 1000 * 60 * 60 * 24 * 30,
        // 每天清理一次
        ttlInterval: 1000 * 60 * 60 * 24
    }
})

/**
 * 获取安全通知集合
 */
export const getSecurityNoticeCollection = createCollectionAccessor<SecurityNotice>({
    lokiName: 'log',
    collectionName: 'securityNotice',
    initOption: {
        // 只保存近一个月的日志
        ttl: 1000 * 60 * 60 * 24 * 30,
        // 每天清理一次
        ttlInterval: 1000 * 60 * 60 * 24
    }
})

/**
 * 获取防重放攻击的 nonce 集合
 */
export const getReplayAttackNonceCollection = createCollectionAccessor<{ value: string }>({
    lokiName: 'log',
    collectionName: 'replayAttackNonce',
    initOption: {
        indices: ['value'],
        // 只保存一分钟的数据
        ttl: 1000 * 60,
        ttlInterval: 1000 * 60
    }
})

/**
 * 发布一条新的安全通知
 */
export const insertSecurityNotice = async (
    type: SecurityNoticeType,
    title: string,
    content: string
) => {
    const noticeCollection = await getSecurityNoticeCollection()
    noticeCollection.insert({ type, title, content, date: new Date().valueOf(), isRead: false })
    saveLoki('log')
}

export type InsertSecurityNoticeFunc = typeof insertSecurityNotice

/**
 * 获取分组集合
 */
export const getGroupCollection = createCollectionAccessor<CertificateGroup>({
    collectionName: 'group',
    initData: [{ name: '我的密码', order: 0 }]
})

/**
 * 获取凭证集合
 */
export const getCertificateCollection = createCollectionAccessor<CertificateDetail>({
    collectionName: 'certificate'
})
