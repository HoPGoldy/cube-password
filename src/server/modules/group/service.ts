import { DatabaseAccessor } from '@/server/lib/sqlite'
import { AddGroupResp, CertificateGroupStorage } from '@/types/group'

interface Props {
    db: DatabaseAccessor
}

export const createGroupService = (props: Props) => {
    const {
        db,
    } = props

    /** 查询分组列表 */
    const queryGroupList = async () => {
        const list = await db.group().select().orderBy('order', 'asc')
        const data = list.map(item => ({
            id: item.id,
            name: item.name,
            requireLogin: !!(item.passwordSalt && item.passwordHash) || !!item.useTotp
        }))
        return { code: 200, data }
    }

    /** 创建分组 */
    const addGroup = async (newData: Omit<CertificateGroupStorage, 'id'>) => {
        const [id] = await db.group().insert(newData)
        const list = await queryGroupList()
        const data: AddGroupResp = { newId: id, newList: list.data }
        return { code: 200, data }
    }

    /** 获取指定分组下的凭证列表 */

    return { queryGroupList, addGroup }
}

export type GroupService = ReturnType<typeof createGroupService>