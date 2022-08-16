import React, { useState } from 'react'
import { ArrowLeft } from '@react-vant/icons'
import { Dialog } from 'react-vant'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useNoticeList } from '../services/log'
import { PageSearchFilter, SecurityNoticeResp } from '@/types/http'
import Pagination from '../components/Pagination'
import Table, { TableColConfig } from '../components/Table'
import { HttpRequestLog, SecurityNotice, SecurityNoticeType } from '@/types/app'
import { Button } from '../components/Button'
import { ActionSheet } from 'react-vant'

interface LogLink {
    name: string
    subname: string
    to: string
}

const logLinks: LogLink[] = [
    { name: '登录日志', subname: '应用登录历史', to: '/logLogin' },
    { name: '凭证查看日志', subname: '凭证详情的查看历史', to: '/LogCertificate' },
    { name: '完整访问日志', subname: '应用接受的所有请求', to: '/logRequest' },
]

const noticeConfig = {
    [SecurityNoticeType.Danger]: { ring: 'ring-red-500', bg: 'bg-red-500' },
    [SecurityNoticeType.Warning]: { ring: 'ring-orange-500', bg: 'bg-orange-500' },
    [SecurityNoticeType.Info]: { ring: 'ring-key-500', bg: 'bg-key-500' },
}

const SecurityMonitor = () => {
    const navigate = useNavigate()
    // 日志列表，首页里只看前十条
    const { data: logList } = useNoticeList({ pageIndex: 1, pageSize: 10 })
    const [logSelectorVisible, setLogSelectorVisible] = useState(false)

    const renderNotice = (notice: SecurityNoticeResp) => {
        const color = noticeConfig[notice.type]

        return (
            <div key={notice.id} className={'bg-white rounded-lg m-4 hover:ring transition ' + color.ring}>
                <div className={'flex flex-nowrap justify-between text-white px-4 py-2 rounded-tl-lg rounded-tr-lg ' + color.bg}>
                    <span className='font-bold'>{notice.title}</span>
                    <span>{notice.date}</span>
                </div>
                <div className='py-2 px-4'>
                    {notice.content}
                </div>
            </div>
        )
    }

    const rnederLogLink = (item: LogLink) => {
        return (
            <div key={item.to} className='m-4 ml-0'>
                <Button block onClick={() => onSelectLogLink(item)}>
                    {item.name}
                </Button>
            </div>
        )
    }

    const onSelectLogLink = (item: LogLink) => {
        navigate(item.to)
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    安全管理
                </Header>

                <div className='w-full overflow-hidden cursor-default'>
                    <div className='mx-4 p-4 bg-green-500 rounded-lg text-white flex flex-nowarp items-center justify-between'>
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
                                        已运行 1 天，检查请求 1021 次
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className='hidden md:block float-right'>
                            查看安全规则
                        </div>
                    </div>
                    <div className='flex flex-nowrap'>
                        <div className='md:w-2/3'>
                            {logList?.entries.map(renderNotice)}
                        </div>
                        <div className='md:w-1/3 hidden md:block'>
                            {logLinks.map(rnederLogLink)}
                        </div>
                    </div>
                </div>
            </PageContent>

            <ActionSheet
                visible={logSelectorVisible}
                actions={logLinks}
                onCancel={() => setLogSelectorVisible(false)}
                onSelect={item => onSelectLogLink(item as LogLink)}
                cancelText="取消"
            />

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={() => setLogSelectorVisible(true)}>查看日志</ActionButton>
            </PageAction>
        </div>
    )
}

export default SecurityMonitor