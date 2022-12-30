import React, { ReactNode, useContext, useState } from 'react'
import { Lock } from '@react-vant/icons'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useCertificateLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'
import { CertificateQueryLog, HttpRequestLog } from '@/types/app'
import { Button } from '../components/Button'
import { AppConfigContext } from '../components/AppConfigProvider'
import { RequestLogDialog } from '../components/RequestLogDialog'

const LogCertificate = () => {
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    // 查询条件
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10 })
    // 正在展示的日志详情
    const [dialogDetail, setDialogDetail] = useState<HttpRequestLog | undefined>(undefined)
    // 日志列表
    const { data: logList, isPreviousData } = useCertificateLogList(queryFilter)

    const tableCol: TableColConfig[] = [
        { dataIndex: 'certificateName', title: '凭证名', render: (_, data: CertificateQueryLog) => {
            let title: ReactNode
            if (data.removed) title = <div className='text-red-500'>凭证已删除</div>
            else if (data.groupUnencrypted) title = <div className='text-transparent select-none' style={{ textShadow: '2px 2px 10px #000000' }}>凭证加密中</div>
            else title = <div>{data.certificateName}</div>

            return (
                <div
                    className='pl-4 py-2 shrink-0 basis-0 grow rounded-tl-lg rounded-bl-lgfont-bold'
                    key='method'
                >{title}</div>
            )
        } },
        { dataIndex: 'groupName', title: '所在分组', render: (_, data: CertificateQueryLog) => {
            return (
                <div
                    className='py-2 shrink-0 basis-0 grow rounded-tl-lg rounded-bl-lg font-bold flex items-center'
                    key='method'
                >
                    {data.groupName}
                    {data.groupUnencrypted && <span className='ml-2 flex items-center bg-slate-500 text-white px-1 rounded text-sm'>
                        <Lock className='mr-1' /> 分组加密中
                    </span>}
                </div>
            )
        } },
        { dataIndex: 'location', title: '来源', width: '200px' },
        { dataIndex: 'date', title: '查看时间', width: '200px' },
        { dataIndex: 'operation', title: '操作', width: '10%', render: (_, data: CertificateQueryLog) => {
            return (
                <div
                    className='pl-4 py-2 shrink-0 w-[10%] text-sky-500 cursor-pointer'
                    onClick={() => setDialogDetail(data)}
                    key='operation'
                >详情</div>
            )
        } },
    ]

    const renderMobileTableRow = (item: CertificateQueryLog) => {
        let title: ReactNode
        if (item.removed) title = <div className='text-red-500'>凭证已删除</div>
        else if (item.groupUnencrypted) title = <div className='text-transparent select-none' style={{ textShadow: '2px 2px 10px #000000' }}>凭证加密中</div>
        else title = <div>{item.certificateName}</div>

        return (
            <div
                className='
                    bg-slate-50 rounded-lg mb-4 p-3 active:scale-95 active:ring ring-slate-400 transition 
                    dark:ring-slate-200 dark:bg-slate-700
                '
                key={item.id}
                onClick={() => setDialogDetail(item)}
            >
                <div className='flex justify-between items-baseline mb-2 font-bold'>
                    <span>{title}</span>
                    <span className='text-slate-500 dark:text-gray-300 flex items-center'>
                        {item.groupName}
                        {item.groupUnencrypted && <span className='ml-2 flex items-center bg-slate-500 text-white px-1 rounded text-sm'>
                            <Lock className='mr-1' /> 分组加密中
                        </span>}
                    </span>
                </div>
                <div className='flex justify-between mb-1'>
                    <span>来源</span>
                    <span className='text-slate-500 dark:text-gray-200'>{item.location}</span>
                </div>
                <div className='flex justify-between'>
                    <span>查看时间</span>
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
                        凭证查看日志
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
                </div>
            </PageContent>

            <RequestLogDialog
                details={dialogDetail}
                onClose={() => setDialogDetail(undefined)}
            />

            <PageAction>
                <ActionButton onClick={() => navigate(-1)}>返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default LogCertificate