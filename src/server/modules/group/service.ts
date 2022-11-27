import { AppStorage, CertificateDetail, CertificateGroup, SecurityNoticeType } from '@/types/app'
import { CreateOtpFunc } from '@/server/lib/auth'
import { AppKoaContext, AppResponse, MyJwtPayload } from '@/types/global'
import { DATE_FORMATTER, STATUS_CODE } from '@/config'
import { AddGroupResp, CertificateListItem, CountInfoResp, GroupAddPasswordData, GroupRemovePasswordData } from '@/types/http'
import { sha } from '@/utils/crypto'
import { authenticator } from 'otplib'
import dayjs from 'dayjs'
import { Next } from 'koa'
import { getNoticeContentPrefix } from '@/server/utils'
import { InsertSecurityNoticeFunc } from '@/server/lib/loki'

interface Props {
    createOTP: CreateOtpFunc
    saveData: () => Promise<void>
    getGroupCollection: () => Promise<Collection<CertificateGroup>>
    getCertificateCollection: () => Promise<Collection<CertificateDetail>>
    getAppStorage: () => Promise<AppStorage>
    updateAppStorage: (data: Partial<AppStorage>) => Promise<void>
    createToken: (payload: Record<string, any>) => Promise<string>
    insertSecurityNotice: InsertSecurityNoticeFunc
}

export const createService = (props: Props) => {
    const {
        createOTP, getAppStorage, updateAppStorage, saveData,
        createToken, getGroupCollection, getCertificateCollection, insertSecurityNotice
    } = props

    const challengeManager = createOTP()

    /**
     * 获取分组列表
     */
    const getCertificateGroupList = async () => {
        const collection = await getGroupCollection()
        return collection.chain().simplesort('order').data().map(item => {
            return {
                id: item.$loki,
                name: item.name,
                requireLogin: !!(item.passwordSalt && item.passwordHash)
            }
        })
    }

    /**
     * 获取指定分组下的凭证列表
     */
    const getCertificateList = async (groupId: number): Promise<CertificateListItem[]> => {
        const collection = await getCertificateCollection()
        return collection.chain().find({ groupId }).simplesort('order').data().map(item => {
            return {
                id: item.$loki,
                name: item.name,
                markColor: item.markColor || '',
                updateTime: dayjs(item.updateTime).format(DATE_FORMATTER)
            }
        })
    }

    const getCountInfo = async () => {
        const groupCollection = await getGroupCollection()
        const certificateCollection = await getCertificateCollection()

        const data: CountInfoResp = {
            group: groupCollection.count(),
            certificate: certificateCollection.count()
        }

        return { code: 200, data }
    }

    const addGroup = async (detail: CertificateGroup) => {
        const groupCollection = await getGroupCollection()

        const result = groupCollection.insert(detail)
        if (!result) {
            return { code: 500, msg: '新增分组失败' }
        }
        const newList = await getCertificateGroupList()

        const data: AddGroupResp = {
            newList,
            newId: (result as any).$loki
        }

        saveData()
        return { code: 200, data }
    }

    const groupNotLoginResp = { code: STATUS_CODE.GROUP_NOT_VERIFY_PASSWORD, msg: '分组未解密' }

    /**
     * 判断指定分组是否解密过
     * @return 已解密则返回 undefined，未解密则返回未解密 resp
     */
    const getGroupLockStatus = async (groupId: number, jwtPayload: MyJwtPayload): Promise<AppResponse | undefined> => {
        if (!groupId) return groupNotLoginResp
        const groupCollection = await getGroupCollection()

        const item = groupCollection.get(groupId)
        if (!item) return groupNotLoginResp

        // 没有密码就等同于已经解密了
        const hasPassword = item.passwordSalt && item.passwordHash
        if (!hasPassword) return undefined

        if (!jwtPayload || !jwtPayload.groups || !jwtPayload.groups.includes(groupId)) {
            return groupNotLoginResp
        }

        return undefined
    }

    /**
     * 更新分组名
     */
    const updateGroupName = async (groupId: number, newName: string, payload: MyJwtPayload) => {
        const lockResp = await getGroupLockStatus(groupId, payload)
        if (lockResp) return lockResp

        const groupCollection = await getGroupCollection()
        const item = groupCollection.get(groupId)
        if (!item) {
            return { code: 500, msg: '分组不存在' }
        }
    
        groupCollection.update({ ...item, name: newName })
        saveData()
        return { code: 200 }
    }

    /**
     * 更新分组排序
     */
    const updateGroupSort = async (newSortIds: number[]) => {
        const groupOrders = newSortIds.reduce((prev, cur, index) => {
            prev[cur] = index
            return prev
        }, {} as Record<number, number>)

        const groupCollection = await getGroupCollection()
        const items = groupCollection.chain().data()
        const newItems = items.map(item => {
            const newOrder = groupOrders[item.$loki]
            return { ...item, order: newOrder || 0 }
        })

        groupCollection.update(newItems)
        saveData()
        return { code: 200 }
    }

    /**
     * 设置默认分组
     */
    const setDefaultGroup = async (groupId: number) => {
        await updateAppStorage({ defaultGroupId: groupId })
        saveData()
        return { code: 200 }
    }

    /**
     * 删除分组
     */
    const deleteGroup = async (groupId: number, payload: MyJwtPayload) => {
        const lockResp = await getGroupLockStatus(groupId, payload)
        if (lockResp) return lockResp

        const groupCollection = await getGroupCollection()
        const certificateCollection = await getCertificateCollection()

        const includesCertificate = certificateCollection.find({ groupId })
        if (includesCertificate.length) {
            return { code: STATUS_CODE.CANT_DELETE, msg: '分组下存在凭证，不能删除' }
        }

        if (groupCollection.count() <= 1) {
            return { code: STATUS_CODE.CANT_DELETE, msg: '不能移除最后一个分组' }
        }
        // 移除分组
        const needDeleteGroup = groupCollection.get(+groupId)
        groupCollection.remove(needDeleteGroup)

        const { defaultGroupId } = await getAppStorage()

        // 看一下是不是把默认分组移除了，是的话就更新一下
        let newDefaultId: number
        if (defaultGroupId === +groupId) {
            newDefaultId = (groupCollection.data[0] as unknown as LokiObj).$loki
            await updateAppStorage({ defaultGroupId: newDefaultId })
        }
        else newDefaultId = defaultGroupId

        saveData()
        return { code: 200, data: newDefaultId }
    }

    const unlockGroup = async (groupId: number, codeHash: string, payload: MyJwtPayload) => {
        const groupCollection = await getGroupCollection()

        const item = groupCollection.get(groupId)
        if (!item) {
            return { code: 404, msg: '分组不存在' }
        }

        const challengeCode = challengeManager.pop(groupId)
        if (!challengeCode) {
            return { code: 200, msg: '挑战码错误' }
        }

        const { passwordHash } = groupCollection.get(groupId)
        if (!passwordHash) {
            return { code: 200, msg: '分组不需要密码' }
        }

        if (sha(passwordHash + challengeCode) !== codeHash) {
            return { code: STATUS_CODE.GROUP_PASSWORD_ERROR, msg: '密码错误，请检查分组密码是否正确' }
        }

        // 把本分组添加到 token 里
        const unlockedGroups = Array.from(new Set([...(payload.groups || []), groupId]))
        const token = await createToken({ groups: unlockedGroups })
        return { code: 200, data: { token } }
    }

    /**
     * 分组设置密码
     */
    const groupAddPassword = async (groupId: number, data: GroupAddPasswordData) => {
        const groupCollection = await getGroupCollection()

        const item = groupCollection.get(+groupId)
        if (!item) {
            return { code: 404, msg: '分组不存在' }
        }

        if (item.passwordHash) {
            return { code: 400, msg: '分组已加密，请先移除密码' }
        }

        item.passwordHash = data.hash
        item.passwordSalt = data.salt

        groupCollection.update(item)

        const newList = await getCertificateGroupList()

        saveData()
        return { code: 200, data: newList }
    }

    /**
     * 请求分组操作挑战码
     * 
     * 在分组解锁、或者执行重要操作时需要请求
     */
    const requireOperate = async (groupId: number) => {
        const groupCollection = await getGroupCollection()

        const item = groupCollection.get(+groupId)
        if (!item) {
            return { code: 404, msg: '分组不存在' }
        }
        const { passwordHash, passwordSalt } = item
        if (!passwordHash || !passwordSalt) {
            return { code: 400, msg: '分组不需要密码' }
        }
    
        const challenge = challengeManager.create(groupId)
        return { code: 200, data: { salt: passwordSalt, challenge } }
    }

    /**
     * 分组移除密码
     */
    const removeGroupPassword = async (groupId: number, data: GroupRemovePasswordData) => {
        const groupCollection = await getGroupCollection()

        const group = groupCollection.get(+groupId)
        if (!group) {
            return { code: 404, msg: '分组不存在' }
        }
    
        const challengeCode = challengeManager.pop(groupId)
        if (!challengeCode) {
            return { code: 400, msg: '挑战码错误' }
        }
    
        const { passwordHash } = groupCollection.get(groupId)
        if (!passwordHash) {
            return { code: 400, msg: '分组没有密码' }
        }
    
        if (sha(passwordHash + challengeCode) !== data.hash) {
            return { code: STATUS_CODE.GROUP_PASSWORD_ERROR, msg: '密码错误，请检查分组密码是否正确' }
        }
    
        const { totpSecret } = await getAppStorage()
        if (totpSecret) {
            if (!data.code) {
                return { code: 400, msg: '请填写动态验证码' }
            }
    
            const isValid = authenticator.verify({ token: data.code, secret: totpSecret })
            if (!isValid) {
                return { code: 400, msg: '动态验证码错误' }
            }
        }
    
        const newGroup = { ...group }
        delete newGroup.passwordHash
        delete newGroup.passwordSalt
    
        groupCollection.update(newGroup)
    
        const newList = await getCertificateGroupList()
    
        saveData()
        return { code: 200, data: newList }
    }

    /**
     * 检查中间件 - 分组解锁是否成功
     */
    const checkIsGroupUnlockSuccess = async (ctx: AppKoaContext, next: Next) => {
        await next()
        if ((ctx.body as any)?.code === 200) return

        const groupCollection = await getGroupCollection()
        const groupId = +ctx.params.groupId
        const item = groupCollection.get(groupId)

        let content = await getNoticeContentPrefix(ctx)
        if (!item) {
            content += `尝试解锁一个不存在的分组(分组 id: ${groupId})。`
            content += '正常使用不应该会产生此请求，请检查是否有攻击者尝试爆破分组密码'
        }
        else content += '进行了一次失败的解锁，请确认是否为本人操作'

        insertSecurityNotice(
            SecurityNoticeType.Warning,
            '分组解锁失败',
            content
        )
    }

    return { getCertificateGroupList, getCertificateList, getGroupLockStatus, getCountInfo, addGroup, updateGroupName, setDefaultGroup, updateGroupSort, deleteGroup, unlockGroup, groupAddPassword, requireOperate, removeGroupPassword, checkIsGroupUnlockSuccess }
}

export type GroupService = ReturnType<typeof createService>

export type GetGroupLockStatusFunc = (groupId: number, jwtPayload: MyJwtPayload) => Promise<AppResponse | undefined>