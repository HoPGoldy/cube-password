import React, { useState } from 'react'
import { ArrowLeft } from '@react-vant/icons'
import { Dialog } from 'react-vant'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'
import { HttpRequestLog, SecurityNotice, SecurityNoticeType } from '@/types/app'

const notices: SecurityNotice[] = [
    { title: '通知标题', content: '通知内容', date: '2020-01-01', id: 1, type: SecurityNoticeType.Info },
    { title: '通知标题', content: '通知内容', date: '2020-01-01', id: 2, type: SecurityNoticeType.Warning },
    { title: '通知标题', content: '通知内容', date: '2020-01-01', id: 3, type: SecurityNoticeType.Danger },
]

const SecurityMonitor = () => {
    const navigate = useNavigate()
    // 查询条件
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10 })
    // 正在展示的日志详情
    const [dialogDetail, setDialogDetail] = useState<HttpRequestLog | undefined>(undefined)
    // 日志列表
    const { data: logList, isPreviousData } = useLogList(queryFilter)

    const renderNotice = (notice: any) => {

    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    安全管理
                </Header>

                <div className='w-full overflow-hidden cursor-default'>
                    <div className='m-4 p-4 bg-green-500 rounded-lg text-white flex flex-nowarp items-center justify-between'>
                        <div className='flex flex-nowarp items-center'>
                            <div className='mr-4 text-4xl'>
                                🌈
                            </div>
                            <div>
                                <div className='font-bold text-xl mb-2'>
                                    安全模块运行中
                                </div>
                                <div>
                                    <span>
                                        已运行 1 天，已检查请求 1021 次
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className='float-right'>
                            查看安全规则
                        </div>
                    </div>
                    <div>
                        <div>
                            
                        </div>
                        <div>
                            <Link to="/logLogin">
                                <div>登录日志</div>
                            </Link>
                            <div>凭证查看日志</div>
                            <Link to="/logRequest">
                                <div>完整访问日志</div>
                            </Link>
                        </div>
                    </div>
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

export default SecurityMonitor