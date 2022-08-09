import React, { useContext, useState } from 'react'
import { ArrowLeft } from '@react-vant/icons'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'

const METHOD_COLOR: Record<string, string> = {
    GET: 'bg-sky-600',
    POST: 'bg-green-600',
    PUT: 'bg-orange-600',
    DELETE: 'bg-red-600',
}

const LogList = () => {
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10 })

    const { data: logList } = useLogList(queryFilter)

    const tableCol: TableColConfig[] = [
        { dataIndex: 'method', title: '类型', width: '100px', render: (data) => {
            return (
                <div className={'pl-4 py-2 shrink-0 w-[100px] rounded-tl rounded-bl text-white font-bold ' + METHOD_COLOR[data as string]}>
                    {data}
                </div>
            )
        } },
        { dataIndex: 'url', title: 'URL' },
        { dataIndex: 'location', title: 'ip 来源', width: '25%' },
        { dataIndex: 'date', title: '请求时间', width: '200px' },
        { dataIndex: 'operation', title: '操作', width: '10%', render: () => {
            return (
                <div className='pl-4 py-2 shrink-0 w-[10%] text-sky-500 cursor-pointer'>
                    详情
                </div>
            )
        } },
    ]

    const renderContent = () => {
        if (!logList) return <div className='p-4 text-center'>加载中</div>

        return (
            <Table dataSource={logList.entries} columns={tableCol} />
        )
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    请求日志
                </Header>

                <div className='w-full overflow-hidden'>
                    {renderContent()}
                    <Pagination
                        className='float-right mr-4'
                        total={logList?.total}
                        {...queryFilter}
                        onChange={(pageIndex, pageSize) => {
                            setQueryFilter({ ...queryFilter, pageIndex, pageSize })
                        }}
                    />
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