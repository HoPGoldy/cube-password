
import { DATE_FORMATTER } from '@/config'
import { LogListResp, LogSearchFilter, NoticeInfoResp, NoticeListResp, NoticeSearchFilter } from '@/types/http'
import dayjs from 'dayjs'
import { useQuery } from 'react-query'
import { sendGet, sendPost } from './base'

/**
 * 获取日志列表
 */
export const getLogs = async (query: LogSearchFilter) => {
    const resp = await sendGet<LogListResp>('/logs', query)
    return {
        ...resp,
        entries: resp.entries.map(item => {
            const data = {
                ...item,
                date: dayjs(item.date).format(DATE_FORMATTER),
                requestBody: JSON.stringify(item.requestBody, null, 4),
                requestParams: JSON.stringify(item.requestParams, null, 4),
                location: (item.location || '').split('|').filter(str => str !== '0').join(', ')
            }

            // 判断 ip 版本
            if (data.ip?.startsWith('::ffff:')) {
                data.ip = data.ip.replace('::ffff:', '')
                data.ipType = 'ipv4'
            }
            else data.ipType = 'ipv6'

            return data
        }),
    }
}

export const useLogList = (query: LogSearchFilter) => {
    return useQuery(['logs', query], () => getLogs(query), {
        keepPreviousData: true
    })
}

/**
 * 获取凭证查看日志列表
 */
export const getCertificateLogs = async (query: LogSearchFilter) => {
    const resp = await sendGet<LogListResp>('/logs/certificates', query)
    return {
        ...resp,
        entries: resp.entries.map(item => {
            const data = {
                ...item,
                date: dayjs(item.date).format(DATE_FORMATTER),
                requestBody: JSON.stringify(item.requestBody, null, 4),
                requestParams: JSON.stringify(item.requestParams, null, 4),
                location: (item.location || '').split('|').filter(str => str !== '0').join(', ')
            }

            // 判断 ip 版本
            if (data.ip?.startsWith('::ffff:')) {
                data.ip = data.ip.replace('::ffff:', '')
                data.ipType = 'ipv4'
            }
            else data.ipType = 'ipv6'

            return data
        }),
    }
}

export const useCertificateLogList = (query: LogSearchFilter) => {
    return useQuery(['logs/certificates', query], () => getCertificateLogs(query), {
        keepPreviousData: true
    })
}

/**
 * 获取通知列表
 */
export const getNotice = async (query: NoticeSearchFilter) => {
    const resp = await sendGet<NoticeListResp>('notices', query)
    return resp
}

export const useNoticeList = (query: NoticeSearchFilter) => {
    return useQuery(['notices', query], () => getNotice(query), {
        keepPreviousData: true
    })
}

/**
 * 切换通知已读/未读状态
 */
export const toggleNoticeRead = async (id: number, isRead: boolean) => {
    return sendPost<NoticeInfoResp>(`notice/${id}/read`, { isRead })
}

/**
 * 已读全部
 */
export const readAllNotice = async () => {
    return sendPost<NoticeInfoResp>('notice/readAll')
}
