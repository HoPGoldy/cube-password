import React, { useContext, useState } from 'react'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from '../Route'
import Header from '../components/Header'
import { useLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'
import { HttpRequestLog } from '@/types/app'
import { Button } from '../components/Button'
import { AppConfigContext } from '../components/AppConfigProvider'
import { METHOD_BG_COLOR, METHOD_TEXT_COLOR, RequestLogDialog } from '../components/RequestLogDialog'

const LogRequest = () => {
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    // 查询条件
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10 })
    // 正在展示的日志详情
    const [dialogDetail, setDialogDetail] = useState<HttpRequestLog | undefined>(undefined)
    // 日志列表
    const { data: logList, isPreviousData } = useLogList(queryFilter)

    const tableCol: TableColConfig[] = [
        { dataIndex: 'method', title: '类型', width: '100px', render: (data) => {
            return (
                <div
                    className={
                        'pl-4 py-2 shrink-0 w-[100px] rounded-tl-lg rounded-bl-lg text-white font-bold '
                        + METHOD_BG_COLOR[data as string]
                    }
                    key='method'
                >{data}</div>
            )
        } },
        { dataIndex: 'name', title: '请求' },
        { dataIndex: 'location', title: 'ip 来源', width: '25%' },
        { dataIndex: 'date', title: '请求时间', width: '200px' },
        { dataIndex: 'operation', title: '操作', width: '10%', render: (_, data) => {
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
                    <span className={METHOD_TEXT_COLOR[item.method]}>{item.method}</span>
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
                    <div className='flex flex-nowrap items-center justify-between w-full'>
                        访问日志
                        <div className='shrink-0 items-center flex flex-nowrap'>
                            <Button
                                className='!hidden md:!block !mx-2'
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

export default LogRequest