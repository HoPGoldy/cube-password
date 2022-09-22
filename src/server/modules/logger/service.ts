import { AppStorage, CertificateDetail, CertificateGroup, CertificateQueryLog, HttpRequestLog, NoticeInfo, SecurityNotice, SecurityNoticeType } from '@/types/app'
import { AppKoaContext, MyJwtPayload } from '@/types/global'
import { createLog } from '@/server/utils'
import { DATE_FORMATTER } from '@/config'
import { LogListResp, LogSearchFilter, NoticeListResp, NoticeSearchFilter, PageSearchFilter, SecurityNoticeResp } from '@/types/http'
import { Next } from 'koa'
import { GetAliasFunc } from '@/server/lib/routeAlias'
import dayjs from 'dayjs'
import { GetGroupLockStatusFunc } from '../group/service'

interface Props {
    saveData: (storageName?: string) => Promise<void>
    getAppStorage: () => Promise<AppStorage>
    getLogCollection: () => Promise<Collection<HttpRequestLog>>
    getNoticeCollection: () => Promise<Collection<SecurityNotice>>
    getGroupCollection: () => Promise<Collection<CertificateGroup>>
    getCertificateCollection: () => Promise<Collection<CertificateDetail>>
    getAlias: GetAliasFunc
    getGroupLockStatus: GetGroupLockStatusFunc
}

export const createService = (props: Props) => {
    const {
        getAppStorage, saveData,
        getLogCollection, getNoticeCollection, getGroupCollection, getCertificateCollection,
        getAlias, getGroupLockStatus
    } = props

    /**
     * 日记记录中间件
     */
    const middlewareLogger = async (ctx: AppKoaContext, next: Next) => {
        await next()
        // 不记录查看日志的请求
        if (ctx.url.includes('/api/logs')) return

        const log = await createLog(ctx)
        ctx.log = log

        const logCollection = await getLogCollection()
        logCollection.insertOne(log)
    }

    /**
     * 获取日志列表
     */
    const getLogList = async (query: LogSearchFilter) => {
        const { pageIndex, pageSize, routes } = query
    
        const logCollection = await getLogCollection()

        const filterObj: LokiQuery<HttpRequestLog> = {}
        if (routes) {
            filterObj.route = { '$containsAny': routes.split(',') }
        }

        const queryChain = logCollection.chain().find(filterObj)
        const targetLogs = queryChain
            .simplesort('date', { desc: true })
            .offset((pageIndex - 1) * pageSize)
            .limit(pageSize)
            .data()
            .map(item => {
                const data: Partial<HttpRequestLog & LokiObj> = {
                    ...item,
                    id: item.$loki,
                    name: getAlias(item.route, item.method)
                }
                delete data.meta
                delete data.$loki
    
                return data as HttpRequestLog
            })
    
        const data: LogListResp = {
            entries: targetLogs,
            total: queryChain.count()
        }
    
        return { code: 200, data }
    }

    /**
     * 获取凭证查看日志列表
     */
    const getCertificateLogList = async (query: PageSearchFilter, payload: MyJwtPayload) => {
        const { pageIndex, pageSize } = query

        const logCollection = await getLogCollection()
        const groupCollection = await getGroupCollection()
        const certificateCollection = await getCertificateCollection()

        const queryChain = logCollection.chain().find({
            route: {'$contains': 'certificate/:certificateId' }
        })

        const targetLogs = queryChain
            .simplesort('date', { desc: true })
            .offset((pageIndex - 1) * pageSize)
            .limit(pageSize)
            .data()
            .map(item => {
                const data: Partial<CertificateQueryLog & LokiObj> = {
                    ...item,
                    id: item.$loki,
                    name: getAlias(item.route, item.method)
                }
                delete data.meta
                delete data.$loki

                return data as CertificateQueryLog
            })

        // 追加凭证信息
        for (const log of targetLogs) {
            const certificateId = log.requestParams?.certificateId
            if (!certificateId) {
                log.removed = true
                return
            }

            const certificate = certificateCollection.get(certificateId)
            if (!certificate) {
                log.removed = true
                continue
            }
            
            const group = groupCollection.get(certificate.groupId)        
            log.groupName = group.name

            // 分组加密了且没解锁，就返回，否则添加凭证名称
            if (group.passwordSalt && group.passwordHash) {
                const isGroupUnlock = await getGroupLockStatus(group.$loki, payload)
                if (!isGroupUnlock) {
                    log.groupUnencrypted = true
                    continue
                }
            }

            log.certificateName = certificate.name
        }

        const data: LogListResp = {
            entries: targetLogs,
            total: queryChain.count()
        }

        return { code: 200, data }
    }

    /**
     * 获取安全通知列表
     */
    const getNoticesList = async (query: NoticeSearchFilter) => {
        const { pageIndex, pageSize, isRead } = query
        const noticeCollection = await getNoticeCollection()

        const filterObj: LokiQuery<SecurityNotice> = {}
        if (isRead !== undefined) filterObj.isRead = isRead

        const queryChain = noticeCollection.chain().find(filterObj)

        // 获取最严重的通知等级
        const topLevel = queryChain.mapReduce(
            item => item.type,
            arr => Math.max(...arr)
        ) as SecurityNoticeType

        const targetLogs = queryChain
            .simplesort('date', { desc: true })
            .offset((pageIndex - 1) * pageSize)
            .limit(pageSize)
            .data()
            .map(item => {
                const data: Partial<SecurityNoticeResp & LokiObj> = {
                    ...item,
                    date: dayjs(item.date).format(DATE_FORMATTER),
                    id: item.$loki,
                }
                delete data.meta
                delete data.$loki

                return data as SecurityNoticeResp
            })

        const { initTime } = await getAppStorage()
        const logCollection = await getLogCollection()

        const data: NoticeListResp = {
            entries: targetLogs,
            total: queryChain.count(),
            topLevel,
            totalScanReq: logCollection.count(),
            initTime: dayjs().diff(dayjs(initTime), 'day')
        }

        return { code: 200, data }
    }

    /**
     * 获取当前未读通知条数和最高等级
     */
    const getNoticeInfo = async (): Promise<NoticeInfo> => {
        const noticeCollection = await getNoticeCollection()
        const queryChain = noticeCollection.chain().find({ isRead: false })
    
        const unReadNoticeTopLevel = queryChain.mapReduce(
            item => item.type,
            arr => Math.max(...arr)
        ) as SecurityNoticeType
        const unReadNoticeCount = queryChain.count()
    
        return { unReadNoticeTopLevel, unReadNoticeCount }
    }

    /**
     * 设置通知的已读 / 未读状态
     */
    const setNoticeStatuc = async (noticeId: number, isRead: boolean) => {
        const noticeCollection = await getNoticeCollection()
        const item = noticeCollection.get(noticeId)
        if (!item) {
            return { code: 500, msg: '通知不存在' }
        }

        noticeCollection.update({ ...item, isRead })

        const data = await getNoticeInfo()
        saveData('log')
        return { code: 200, data }
    }

    /**
     * 已读所有未读通知
     */
    const readAll = async () => {
        const noticeCollection = await getNoticeCollection()
        noticeCollection.findAndUpdate({ isRead: false }, old => {
            old.isRead = true
        })
    
        const data = await getNoticeInfo()
        saveData('log')
        return { code: 200, data }
    }

    return { middlewareLogger, getLogList, getCertificateLogList, getNoticesList, setNoticeStatuc, readAll, getNoticeInfo }
}

export type LoggerService = ReturnType<typeof createService>