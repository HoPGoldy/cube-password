import { CertificateDetail } from '@/types/app'
import { MyJwtPayload } from '@/types/global'
import { DATE_FORMATTER } from '@/config'
import { CertificateDetailResp } from '@/types/http'
import dayjs from 'dayjs'
import { GetGroupLockStatusFunc } from '../group/service'

interface Props {
    saveData: () => Promise<void>
    getCertificateCollection: () => Promise<Collection<CertificateDetail>>
    getGroupLockStatus: GetGroupLockStatusFunc
}

export const createService = (props: Props) => {
    const { saveData, getCertificateCollection, getGroupLockStatus } = props

    /**
     * 查询凭证详情数据
     */
    const getCertificateDetail = async (certificateId: number, payload: MyJwtPayload) => {
        const collection = await getCertificateCollection()
        const certificate = collection.get(certificateId)
        // 找不到凭证也返回分组未解密，防止攻击者猜到哪些 id 上有信息
        const lockResp = await getGroupLockStatus(certificate?.groupId, payload)
        if (lockResp) return lockResp
        
        const data: CertificateDetailResp = {
            name: certificate.name,
            content: certificate.content,
            markColor: certificate.markColor || '',
            updateTime: dayjs(certificate.updateTime).format(DATE_FORMATTER),
            createTime: dayjs(certificate.meta.created).format(DATE_FORMATTER)
        }
        return { code: 200, data }
    }

    /**
     * 更新排序
     */
    const updateSort = async (newSortIds: number[]) => {
        const itemOrders = newSortIds.reduce((prev, cur, index) => {
            prev[cur] = index
            return prev
        }, {} as Record<number, number>)

        const certificateCollection = await getCertificateCollection()
        const items = certificateCollection.find({ '$loki': { $in: newSortIds }})

        const newItems = items.map(item => {
            const newOrder = itemOrders[item.$loki]
            return { ...item, order: newOrder || 0 }
        })

        certificateCollection.update(newItems)
        saveData()
        return { code: 200 }
    }

    /**
     * 删除凭证
     */
    const deleteCertificate = async (certificateIds: number[], payload: MyJwtPayload) => {
        const collection = await getCertificateCollection()

        // 先保证要删除的凭证分组都解锁了
        for (const certificateId of certificateIds) {
            const certificate = collection.get(certificateId)
            const lockResp = await getGroupLockStatus(certificate?.groupId, payload)
            if (lockResp) return lockResp
        }

        certificateIds.forEach(id => collection.remove(id))
        saveData()
        return { code: 200 }
    }

    /**
     * 批量修改凭证分组
     *
     * @param certificateIds 要移除的凭证 id 数组
     * @param newGroupId 要移动到的新分组 id
     * @param payload 用户登录 jwt 载荷
     */
    const moveCertificate = async (certificateIds: number[], newGroupId: number, payload: MyJwtPayload) => {
        const collection = await getCertificateCollection()

        // 先保证要移动的凭证分组都解锁了
        for (const certificateId of certificateIds) {
            const certificate = collection.get(certificateId)
            const lockResp = await getGroupLockStatus(certificate?.groupId, payload)
            if (lockResp) return lockResp
        }

        certificateIds.forEach(id => {
            const item = collection.get(+id)
            if (item) collection.update({ ...item, groupId: newGroupId })
        })

        saveData()
        return { code: 200 }
    }

    /**
     * 添加新凭证
     */
    const addCertificate = async (detail: CertificateDetail, payload: MyJwtPayload) => {
        const lockResp = await getGroupLockStatus(detail.groupId, payload)
        if (lockResp) return lockResp

        const collection = await getCertificateCollection()
        const result = collection.insertOne({
            ...detail,
            updateTime: new Date().valueOf()
        })
        if (!result) {
            return { code: 500, msg: '新增凭证失败' }
        }

        saveData()
        return { code: 200, data: { id: result.$loki } }
    }

    /**
     * 修改凭证数据
     */
    const updateCertificate = async (id: number, detail: Partial<CertificateDetail>, payload: MyJwtPayload) => {
        const collection = await getCertificateCollection()

        const item = collection.get(+id)
        const lockResp = await getGroupLockStatus(item?.groupId, payload)
        if (lockResp) return lockResp

        if (item) collection.update({ ...item, ...detail })
        saveData()
        return { code: 200 }
    }

    return { getCertificateDetail, deleteCertificate, moveCertificate, addCertificate, updateCertificate, updateSort }
}

export type CertificateService = ReturnType<typeof createService>