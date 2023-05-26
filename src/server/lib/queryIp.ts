import Searcher from './ip2region'

// 指定ip2region数据文件路径
const dbPath = './ip2region.xdb'

// 同步读取vectorIndex
const vectorIndex = Searcher.loadVectorIndexFromFile(dbPath)
// 创建searcher对象
const searcher = Searcher.newWithVectorIndex(dbPath, vectorIndex)

/**
 * 查询一个 ipv4 的实际地址
 * 结果为 国家|区域|省份|城市|服务提供商
 */
export const queryIp = async (ip?: string): Promise<string> => {
    try {
        // 不是 ipv4 地址，没法查询
        if (!ip || !ip.startsWith('::ffff:')) return ''
        const pureIp = ip?.replace('::ffff:', '')

        // 查询 await 或 promise均可
        const data = await searcher.search(pureIp)
        if (!data || !data.region) return ''
        // data: {region: '中国|0|江苏省|苏州市|电信', ioCount: 2, took: 0.402874}

        return data.region
    } catch(e) {
        console.error('ip 地址查询失败', e)
        return ''
    }
}