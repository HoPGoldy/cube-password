import React, { useContext, useState } from 'react'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'
import { HttpRequestLog } from '@/types/app'
import { Button } from '../components/Button'
import { AppConfigContext } from '../components/AppConfigProvider'
import { RequestLogDialog } from '../components/RequestLogDialog'

const LogLogin = () => {
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    // 查询条件
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10, routes: '/requireLogin,/login' })
    // 正在展示的日志详情
    const [dialogDetail, setDialogDetail] = useState<HttpRequestLog | undefined>(undefined)
    // 日志列表
    const { data: logList, isPreviousData } = useLogList(queryFilter)

    const tableCol: TableColConfig[] = [
        { dataIndex: 'method', title: '结果', width: '100px', render: (_, data: HttpRequestLog) => {
            let bgColor = 'bg-gray-600'
            let text = '预请求'
            if (!data.route.endsWith('requireLogin')) {
                bgColor = (data.responseStatus === 200) ? 'bg-green-600' : 'bg-red-600'
                text = (data.responseStatus === 200) ? '成功' : '失败'
            }

            return (
                <div
                    className={
                        'pl-4 py-2 shrink-0 w-[100px] rounded-tl-lg rounded-bl-lg text-white '
                        + bgColor
                    }
                    key='method'
                >{text}</div>
            )
        } },
        { dataIndex: 'name', title: '请求' },
        { dataIndex: 'location', title: 'ip 来源', width: '25%' },
        { dataIndex: 'date', title: '登录时间', width: '200px' },
        { dataIndex: 'operation', title: '操作', width: '10%', render: (_, data: HttpRequestLog) => {
            return (
                <div
                    className='pl-4 py-2 shrink-0 w-[10%] text-sky-500 cursor-pointer'
                    onClick={() => setDialogDetail(data)}
                    key='operation'
                >详情</div>
            )
        } },
    ]

    const renderMobileTableRow = (item: HttpRequestLog) => {
        let textColor = 'text-gray-600 dark:text-gray-400'
        let text = '预请求'
        if (!item.route.endsWith('requireLogin')) {
            textColor = (item.responseStatus === 200) ? 'text-green-600' : 'text-red-600'
            text = (item.responseStatus === 200) ? '成功' : '失败'
        }

        return (
            <div
                className='
                    bg-slate-50 rounded-lg mb-4 p-3 active:scale-95 active:ring ring-slate-400 transition 
                    dark:ring-slate-200 dark:bg-slate-700
                '
                key={item.id}
                onClick={() => setDialogDetail(item)}
            >
                <div className='flex justify-between mb-2 font-bold'>
                    <span>{item.name}</span>
                    <span className={textColor}>{text}</span>
                </div>
                <div className='flex justify-between mb-1'>
                    <span>来源</span>
                    <span className='text-slate-500 dark:text-gray-200'>{item.location}</span>
                </div>
                <div className='flex justify-between'>
                    <span>请求时间</span>
                    <span className='text-slate-500 dark:text-gray-200'>{item.date}</span>
                </div>
            </div>
        )
    }

    const renderContent = () => {
        if (!logList || isPreviousData) return <div className='p-4 text-center text-gray-300'>加载中</div>

        return (
            <Table dataSource={logList.entries} columns={tableCol} renderMobile={renderMobileTableRow} />
        )
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    <div className='flex flex-nowrap items-center justify-center md:justify-between w-full'>
                        登录日志
                        <div className='hidden shrink-0 items-center md:flex flex-nowrap mx-2'>
                            <Button
                                color={config?.buttonColor}
                                onClick={() => navigate(-1)}
                            >
                                返 回
                            </Button>
                        </div>
                    </div>
                </Header>

                <div className='w-full overflow-hidden'>
                    {renderContent()}
                    <Pagination
                        className='w-full md:w-auto md:float-right px-4 pb-2 md:pb-4'
                        total={logList?.total}
                        {...queryFilter}
                        onChange={(pageIndex, pageSize) => {
                            setQueryFilter({ ...queryFilter, pageIndex, pageSize })
                        }}
                    />

                    <RequestLogDialog
                        details={dialogDetail}
                        onClose={() => setDialogDetail(undefined)}
                    />
                </div>
            </PageContent>

            <PageAction>
                <ActionButton onClick={() => navigate(-1)}>返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default LogLogin