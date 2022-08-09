
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
        entries: resp.entries.map(item => ({
            ...item,
            date: dayjs(item.date).format(DATE_FORMATTER),
            location: (item.location || '').split('|').filter(str => str !== '0').join(', ')
        })),
    }
}

export const useLogList = (query: LogSearchFilter) => {
    return useQuery(['logs', query], () => getLogs(query), {
        keepPreviousData: true
    })
}
