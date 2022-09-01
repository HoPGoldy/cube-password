import React, { useContext, useState } from 'react'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from '../Route'
import Header from '../components/Header'
import { useNoticeList } from '../services/log'
import { PageSearchFilter } from '@/types/http'
import Pagination from '../components/Pagination'
import { Button } from '../components/Button'
import { AppConfigContext } from '../components/AppConfigProvider'
import { SecurityNotice } from '../components/SecurityNotice'
import { queryClient } from '../components/QueryClientProvider'

const LogLogin = () => {
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    // 查询条件
    const [queryFilter, setQueryFilter] = useState<PageSearchFilter>({ pageIndex: 1, pageSize: 10 })
    // 日志列表
    const { data: noticeList, isPreviousData } = useNoticeList(queryFilter)

    const onNoticeChange = () => {
        queryClient.fetchQuery(['notices', queryFilter])
    }

    const renderNoticeList = () => {
        if (isPreviousData) {
            return (
                <div className='text-center m-4 text-slate-500'>
                    加载中
                </div>
            )
        }
        if (!noticeList || noticeList.entries.length <= 0) {
            return (
                <div className='text-center m-4 text-slate-500'>
                    暂无通知
                </div>
            )
        }

        return (<>
            {noticeList.entries.map(item => <SecurityNotice key={item.id} detail={item} onChange={onNoticeChange} />)}
            <Pagination
                className='w-full md:w-auto md:float-right px-4 pb-2 md:pb-4'
                total={noticeList?.total}
                {...queryFilter}
                onChange={(pageIndex, pageSize) => {
                    setQueryFilter({ ...queryFilter, pageIndex, pageSize })
                }}
            />
        </>)
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    <div className='flex flex-nowrap items-center justify-center md:justify-between w-full'>
                        历史通知列表
                        <div className='hidden shrink-0 items-center md:flex flex-nowrap mx-2'>
                            <Button
                                color={config?.buttonColor}
                                onClick={() => navigate(-1)}
                            >返 回</Button>
                        </div>
                    </div>
                </Header>

                <div className='w-full overflow-hidden'>
                    {renderNoticeList()}
                </div>
            </PageContent>

            <PageAction>
                <ActionButton onClick={() => navigate(-1)}>返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default LogLogin