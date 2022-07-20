import lokijs from 'lokijs'
import { ensureDir } from 'fs-extra'
import { AppStorage, AppTheme, CertificateDetail, CertificateField, CertificateGroup, DetailCheckLog, LoginLog } from '@/types/app'
import { DB_NAME, STORAGE_PATH } from '@/config'

/**
 * 全局唯一的 loki 实例缓存
 */
let lokiInstances: lokijs

/**
 * 获取全局 loki 存储实例
 */
export const getLoki = async (): Promise<lokijs> => {
    if (lokiInstances) return lokiInstances

    await ensureDir(STORAGE_PATH)

    return new Promise(resolve => {
        lokiInstances = new lokijs(STORAGE_PATH + '/' + DB_NAME, {
            autoload: true,
            autosave: true,
            autosaveInterval: 1000 * 60 * 60 * 24,
            autoloadCallback: () => resolve(lokiInstances)
        })
    })
}

/**
 * 保存数据到本地
 */
export const saveLoki = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!lokiInstances) return resolve()

        lokiInstances.saveDatabase(err => {
            if (err) reject(err)
            resolve()
        })
    })
}

/**
 * 创建集合访问器
 * @param collectionName 集合名
 * @returns 一个 async 函数，调用后返回对应的集合
 */
export const createCollectionAccessor = <T extends Record<string | number, any>>(
    collectionName: string,
    initOption?: Partial<CollectionOptions<T>>,
    initData?: T[]
) => {
    return async () => {
        const loki = await getLoki()
        const collection = loki.getCollection<T>(collectionName)
        if (collection) return collection

        const newCollection = loki.addCollection<T>(collectionName, initOption)
        if (initData) newCollection.insert(initData)
        return newCollection
    }
}

const getAppStorageCollection = createCollectionAccessor<AppStorage>('global')

/**
 * 获取应用全局数据
 */
export const getAppStorage = async () => {
    const collection = await getAppStorageCollection()
    return collection.data[0] || collection.insert({ theme: AppTheme.Light, defaultGroupId: 1 })
}

/**
 * 更新应用全局数据
 */
export const updateAppStorage = async (newStorage: Partial<AppStorage>) => {
    const collection = await getAppStorageCollection()

    const oldStorage = collection.data[0] || collection.insert({ theme: AppTheme.Light, defaultGroupId: 1 })
    const fullStorage = { ...oldStorage, ...newStorage }
    collection.update(fullStorage)
}

/**
 * 获取登录日志集合
 */
export const getLoginLogCollection = createCollectionAccessor<LoginLog>('loginLog')

/**
 * 获取详情查看日志集合
 */
export const getDetailCheckLogCollection = createCollectionAccessor<DetailCheckLog>('detailCheckLog')

/**
 * 获取分组集合
 */
export const getGroupCollection = createCollectionAccessor<CertificateGroup>('group', undefined, [{ name: '我的密码' }])

/**
 * 获取默认凭证字段集合
 */
export const getDefaultFieldCollection = createCollectionAccessor<CertificateField>('defaultField')

/**
 * 获取凭证集合
 */
export const getCertificateCollection = createCollectionAccessor<CertificateDetail>('certificate')
