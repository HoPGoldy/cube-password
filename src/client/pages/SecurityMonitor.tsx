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
import { HttpRequestLog } from '@/types/app'

const SecurityMonitor = () => {
    const navigate = useNavigate()
    // 查询条件
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10 })
    // 正在展示的日志详情
    const [dialogDetail, setDialogDetail] = useState<HttpRequestLog | undefined>(undefined)
    // 日志列表
    const { data: logList, isPreviousData } = useLogList(queryFilter)

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    安全管理
                </Header>

                <div className='w-full overflow-hidden'>
                    <div>
                        安全模块运行中
                        安全模块会监控所有请求并分析意图
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