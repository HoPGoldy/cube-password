import { CertificateGroup, HttpRequestLog } from '@/types/app'
import { sha } from '@/utils/common'
import { nanoid } from 'nanoid'
import React, { useContext, useState } from 'react'
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowLeft } from '@react-vant/icons'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useLogList } from '../services/log'
import { LogSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'

const LogList = () => {
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    const [queryFilter, setQueryFilter] = useState<LogSearchFilter>({ pageIndex: 1, pageSize: 10 })

    const { data: logList, isLoading } = useLogList(queryFilter)

    const renderLogItem = (item: HttpRequestLog) => {
        return <div>{JSON.stringify(item)}</div>
    }

    const renderContent = () => {
        if (!logList || isLoading) return <div>加载中</div>
        if (logList.total === 0) return <div>暂无数据</div>

        return logList.entries.map(renderLogItem)
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