import Searcher from './ip2region'

// 指定ip2region数据文件路径
const dbPath = './ip2region.xdb'

interface IpRegion {
    /**
     * 国家
     */
    country?: string
    /**
     * 区域
     */
    area?: string
    /**
     * 省份
     */
    province?: string
    /**
     * 城市
     */
    city?: string
    /**
     * 服务提供商
     */
    isp?: string
}

// 同步读取vectorIndex
const vectorIndex = Searcher.loadVectorIndexFromFile(dbPath)
// 创建searcher对象
const searcher = Searcher.newWithVectorIndex(dbPath, vectorIndex)

/**
 * 查询一个 ipv4 的实际地址
 */
export const queryIp = async (ip: string): Promise<string> => {
    try {
        // 查询 await 或 promise均可
        const data = await searcher.search(ip)
        if (!data || !data.region) return ''
        // data: {region: '中国|0|江苏省|苏州市|电信', ioCount: 2, took: 0.402874}

        return data.region
        // const [country, area, province, city, isp] = data.region.split('|')
        // {
        //     country: country === '0' ? undefined : country,
        //     area: area === '0' ? undefined : area,
        //     province: province === '0' ? undefined : province,
        //     city: city === '0' ? undefined : city,
        //     isp: isp === '0' ? undefined : isp
        // }
    } catch(e) {
        console.error('ip 地址查询失败', e)
        return ''
    }
}