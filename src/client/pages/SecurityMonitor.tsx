import React, { useContext, useState } from 'react'
import { ArrowLeft, OrdersO, Success } from '@react-vant/icons'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from 'react-router-dom'
import { readAllNotice, useNoticeList } from '../services/log'
import { Button } from '../components/Button'
import { ActionSheet, Popup, Sticky, Dialog } from 'react-vant'
import { SecurityNotice } from '../components/SecurityNotice'
import { SecurityNoticeType } from '@/types/app'
import { UserContext } from '../components/UserProvider'

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

interface SecurityRule {
    name: string
    content: string
}

const securityRules: SecurityRule[] = [
    {
        name: '登录失败',
        content: '每天最多允许登录失败三次，超过三次后应用后台将会被锁定 24 小时。如果次日仍然登录失败三次，系统将被完全锁死，只能重启服务。'
    },
    {
        name: '异地登录',
        content: '异地登录将要求输入动态令牌（如果绑定了的话），并提示异地登录安全通知。'
    },
    {
        name: '休息时段登录',
        content: '当休息时段（凌晨0点 - 凌晨5点）出现登录行为时，应用将会记录并通过安全通知提醒用户。'
    },
    {
        name: '登录请求审查',
        content: '为了保证安全性，应用在登录之前会先预请求授权，因此登录和请求授权总是成对出现的，当单独出现其中一种请求时，将会判断为存在攻击者。'
    },
    {
        name: '分组解密审查',
        content: '当分组密码错误或者尝试解锁一个不存在的分组时，应用将会记录并通过安全通知提醒用户。'
    },
    {
        name: '404 请求警告',
        content: '当有客户端请求了不存在的网址路由时发出警告，如果自己没有不小心输错网址的话，则可以判定为有人在尝试爆破可用路由。'
    },
]

const headerConfig = {
    [SecurityNoticeType.Info]: {
        bg: 'bg-sky-500',
        title: '发现安全提示，请检查通知',
        icon: '🌞'
    },
    [SecurityNoticeType.Warning]: {
        bg: 'bg-orange-500',
        title: '发现安全风险，请检查通知',
        icon: '🚧'
    },
    [SecurityNoticeType.Danger]: {
        bg: 'bg-red-500',
        title: '发现严重安全问题，请尽快修改密码',
        icon: '🔥'
    },
    default: {
        bg: 'bg-green-500',
        title: '安全模块运行中',
        icon: '🌈'
    },
}

const getHeaderConfig = (topLevel?: SecurityNoticeType) => {
    if (topLevel && (topLevel in headerConfig)) return headerConfig[topLevel]
    return headerConfig.default
}

const SecurityMonitor = () => {
    const navigate = useNavigate()
    const { setNoticeInfo } = useContext(UserContext)
    // 日志列表，首页里只看前十条
    const { data: noticeResp, isLoading, refetch: refetchNoticeList } = useNoticeList(unReadNoticeFilter)
    // 是否显示日志入口抽屉
    const [logSelectorVisible, setLogSelectorVisible] = useState(false)
    // 是否显示安全规则弹窗
    const [ruleVisible, setRuleVisible] = useState(false)

    const onNoticeChange = () => {
        refetchNoticeList()
    }

    const onReadAll = async () => {
        await Dialog.confirm({
            title: <div className='dark:text-slate-200'>清除未读通知</div>,
            message: <div className='dark:text-slate-200'>确认要清除么？忽略红色通知可能会导致密码泄露。</div>,
            confirmButtonText: '清除'
        })
        const data = await readAllNotice()
        setNoticeInfo(data)
        refetchNoticeList()
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

    const renderSecurityRule = (item: SecurityRule) => {
        return (
            <div className='mb-4' key={item.name}>
                <div className='font-bold mb-1 dark:text-gray-400'>{item.name}</div>
                <div className='text-gray-600 dark:text-gray-200'>{item.content}</div>
            </div>
        )
    }

    const renderNoticeList = () => {
        if (!noticeResp || noticeResp.entries.length <= 0) {
            return (
                <div className='text-center m-4 text-slate-500 dark:text-slate-300'>
                    暂无未读通知，可通过 “历史通知” 查看所有已读通知
                </div>
            )
        }

        return noticeResp.entries.map(item => <SecurityNotice key={item.id} detail={item} onChange={onNoticeChange} />)
    }

    const onSelectLogLink = (item: LogLink) => {
        navigate(item.to)
    }
    
    const headerConfig = getHeaderConfig(noticeResp?.topLevel)

    return (
        <div>
            <PageContent>
                <div className='w-full overflow-hidden cursor-default'>
                    <div className={
                        'mx-4 mt-4 p-4 rounded-lg text-white flex flex-nowarp items-center justify-between transition '
                        + headerConfig.bg
                    }>
                        <div className='flex flex-nowarp items-center'>
                            <div className='mr-4 text-4xl'>
                                {headerConfig.icon}
                            </div>
                            <div>
                                <div className='font-bold text-lg md:text-xl md:mb-2'>
                                    {headerConfig.title}
                                </div>
                                <div>
                                    <span>
                                        {isLoading ? '加载中' : (
                                            (`已运行 ${noticeResp?.initTime} 天，检查请求 ${noticeResp?.totalScanReq} 次`) +
                                            ((noticeResp?.total || 0) > 0 ? `，剩余 ${noticeResp?.total} 条未读` : '')
                                        )}
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
                            <Sticky offsetTop={8}>
                                {(noticeResp?.entries.length || 0) > 0 && <div className='m-4 ml-0'>
                                    <Button block onClick={onReadAll}>
                                        清除未读通知
                                    </Button>
                                </div>}
                                {logLinks.map(rnederLogLink)}
                            </Sticky>
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
                round
                className='w-[90%] md:w-1/2'
                visible={ruleVisible}
                onClose={() => setRuleVisible(false)}
            >
                <div className='p-4' onClick={() => setRuleVisible(false)}>
                    {securityRules.map(renderSecurityRule)}
                </div>
            </Popup>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionIcon onClick={() => setRuleVisible(true)}>
                    <OrdersO fontSize={24} />
                </ActionIcon>
                {(noticeResp?.entries.length || 0) > 0 &&
                <ActionIcon onClick={onReadAll}>
                    <Success fontSize={24} />
                </ActionIcon>}
                <ActionButton onClick={() => setLogSelectorVisible(true)}>查看日志</ActionButton>
            </PageAction>
        </div>
    )
}

export default SecurityMonitor