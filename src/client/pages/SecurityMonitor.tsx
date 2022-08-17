import React, { useState } from 'react'
import { ArrowLeft, OrdersO } from '@react-vant/icons'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useNoticeList } from '../services/log'
import { Button } from '../components/Button'
import { ActionSheet, Popup } from 'react-vant'
import { SecurityNotice } from '../components/SecurityNotice'
import { queryClient } from '../components/QueryClientProvider'

interface LogLink {
    name: string
    subname: string
    to: string
}

const logLinks: LogLink[] = [
    { name: '登录日志', subname: '应用登录历史', to: '/logLogin' },
    { name: '凭证查看日志', subname: '凭证详情的查看历史', to: '/LogCertificate' },
    { name: '完整访问日志', subname: '应用接受的所有请求', to: '/logRequest' },
    { name: '历史通知', subname: '被标记为已读的通知信息', to: '/NoticeList' },
]

const unReadNoticeFilter = { pageIndex: 1, pageSize: 10, isRead: false }

const SecurityMonitor = () => {
    const navigate = useNavigate()
    // 日志列表，首页里只看前十条
    const { data: noticeList } = useNoticeList(unReadNoticeFilter)
    // 是否显示日志入口抽屉
    const [logSelectorVisible, setLogSelectorVisible] = useState(false)
    // 是否显示安全规则弹窗
    const [ruleVisible, setRuleVisible] = useState(false)

    const onNoticeChange = () => {
        queryClient.fetchQuery(['notices', unReadNoticeFilter])
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

    const renderNoticeList = () => {
        if (!noticeList || noticeList.entries.length <= 0) {
            return (
                <div className='text-center m-4 text-slate-500'>
                    暂无未读通知，可通过“历史通知”选项查看所有已读通知
                </div>
            )
        }

        return noticeList.entries.map(item => <SecurityNotice key={item.id} detail={item} onChange={onNoticeChange} />)
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
                    <div className='mx-4 mt-4 p-4 bg-green-500 rounded-lg text-white flex flex-nowarp items-center justify-between'>
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
                        <div className='hidden md:block float-right cursor-pointer' onClick={() => setRuleVisible(true)}>
                            查看安全规则
                        </div>
                    </div>
                    <div className='flex flex-nowrap'>
                        <div className='w-full md:w-2/3'>
                            {renderNoticeList()}
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

            <Popup
                visible={ruleVisible}
                onClose={() => setRuleVisible(false)}
            >
                <div style={{ padding: '30px 50px' }}>内容</div>
            </Popup>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionIcon onClick={() => setRuleVisible(true)}>
                    <OrdersO fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={() => setLogSelectorVisible(true)}>查看日志</ActionButton>
            </PageAction>
        </div>
    )
}

export default SecurityMonitor