
import { DATE_FORMATTER } from '@/config'
import { LogListResp, LogSearchFilter } from '@/types/http'
import dayjs from 'dayjs'
import { useQuery } from 'react-query'
import { sendGet } from './base'

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