
import { LogListResp, LogSearchFilter } from '@/types/http'
import { useQuery } from 'react-query'
import { sendGet } from './base'

/**
 * 获取日志列表
 */
export const getLogs = async (query: LogSearchFilter) => {
    return await sendGet<LogListResp>('/log', query)
}

export const useLogList = (query: LogSearchFilter) => {
    return useQuery(['logs', query], () => getLogs(query), {
        keepPreviousData: true
    })
}
