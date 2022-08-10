import React, { useState } from 'react'
import { ArrowLeft } from '@react-vant/icons'
import { Dialog } from 'react-vant'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'
import { HttpRequestLog } from '@/types/app'

const METHOD_BG_COLOR: Record<string, string> = {
    GET: 'bg-sky-600',
    POST: 'bg-green-600',
    PUT: 'bg-orange-600',
    DELETE: 'bg-red-600',
}

const METHOD_TEXT_COLOR: Record<string, string> = {
    GET: 'text-sky-600',
    POST: 'text-green-600',
    PUT: 'text-orange-600',
    DELETE: 'text-red-600',
}

const LogList = () => {
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
                className='bg-slate-50 rounded-lg mb-4 p-3 active:scale-95 active:ring ring-slate-400 transition'
                key={item.id}
                onClick={() => setDialogDetail(item)}
            >
                <div className='flex justify-between mb-2 font-bold'>
                    <span>{item.name}</span>
                    <span className={METHOD_TEXT_COLOR[item.method]}>{item.method}</span>
                </div>
                <div className='flex justify-between mb-1'>
                    <span>来源</span>
                    <span className='text-slate-500'>{item.location}</span>
                </div>
                <div className='flex justify-between'>
                    <span>请求时间</span>
                    <span className='text-slate-500'>{item.date}</span>
                </div>
            </div>
        )
    }

    const renderContent = () => {
        if (!logList || isPreviousData) return <div className='p-4 text-center'>加载中</div>

        return (
            <Table dataSource={logList.entries} columns={tableCol} renderMobile={renderMobileTableRow} />
        )
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    访问日志
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

                    <Dialog
                        visible={!!dialogDetail}
                        showCancelButton
                        showConfirmButton={false}
                        cancelButtonText="关闭"
                        onCancel={() => setDialogDetail(undefined)}
                        onClose={() => setDialogDetail(undefined)}
                    >
                        <div className='p-4'>
                            <header className='flex flex-row flex-nowrap justify-between items-center mb-4 pb-4 border-b'>
                                <div>
                                    <div className='text-lg font-bold'>{dialogDetail?.name}</div>
                                    <div className='text-sm'>
                                        <span className='mr-4'>HTTP {dialogDetail?.responseHttpStatus}</span>
                                        <span>响应状态码 {dialogDetail?.responseStatus}</span>
                                    </div>
                                </div>
                                <div className={
                                    'text-white py-1 px-2 rounded ' + 
                                    METHOD_BG_COLOR[dialogDetail?.method || '']
                                }>
                                    {dialogDetail?.method}
                                </div>
                            </header>
                            
                            <div className='mb-1'>
                                <span>请求接口：</span>
                                <span className='float-right text-slate-500'>{dialogDetail?.url}</span>
                            </div>
                            <div className='mb-1'>
                                <span>请求 ip：</span>
                                <span className='float-right text-slate-500'>{dialogDetail?.ipType}</span>
                                <span className='float-right text-slate-500'>{dialogDetail?.ip}</span>
                            </div>
                            <div className='mb-1'>
                                <span>ip 所在地：</span>
                                <span className='float-right text-slate-500'>{dialogDetail?.location}</span>
                            </div>
                            <div className='mb-1'>
                                <span>请求时间：</span>
                                <span className='float-right text-slate-500'>{dialogDetail?.date}</span>
                            </div>
                            <div className='mb-1'>
                                <div>请求 params：</div>
                                <code className='bg-slate-200 rounded p-2 mt-1 overflow-auto block'>
                                    {dialogDetail?.requestParams}
                                </code>
                            </div>
                            <div className='mb-1'>
                                <div>请求 body：</div>
                                <code className='bg-slate-200 rounded p-2 mt-1 overflow-auto block'>
                                    {dialogDetail?.requestBody}
                                </code>
                            </div>
                        </div>
                    </Dialog>
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={() => navigate(-1)}>返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default LogList