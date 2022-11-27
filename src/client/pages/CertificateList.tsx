import React, { useContext, useState, ReactElement, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/client/components/Button'
import { Dialog, Loading, Notify } from 'react-vant'
import { SettingO, MoreO, Plus, Success, Search, ArrowDown } from '@react-vant/icons'
import { hasGroupLogin, useJwtPayload, UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { Link } from '../Route'
import Header from '../components/Header'
import { CertificateListItem } from '@/types/http'
import CertificateDetail from '../components/CertificateDetail'
import { useEditor } from './CertificateList.hook'
import { updateGroupName } from '../services/certificateGroup'
import GroupLogin, { GroupUnlockRef } from '../components/GroupLogin'
import { noticeConfig } from '../components/SecurityNotice'
import { GroupSelectSheet } from '../components/GroupSelectSheet'
import { queryClient } from '../components/QueryClientProvider'
import { ReactSortable } from 'react-sortablejs'
import { updateCertificateSort } from '../services/certificate'

interface ConfigButtonProps {
    onClick: () => void
    icon: ReactElement
    label: string
}

const CertificateList = () => {
    const {
        certificateList, groupList, noticeInfo, selectedGroup, certificateListLoading,
        refetchCertificateList, refetchGroupList
    } = useContext(UserContext)
    const jwtPayload = useJwtPayload()
    const config = useContext(AppConfigContext)
    // 登录页组件引用，用于让移动端底部主按钮触发解锁分组
    const groupUnlockRef = useRef<GroupUnlockRef>(null)
    // 是否显示详情页
    const [detailVisible, setDetailVisible] = useState(false)
    // 当前详情页显示的密码 id，设为空来显示新增页
    const [showCertificateId, setShowCertificateId] = useState<number | undefined>(undefined)
    // 引入列表编辑功能
    const {
        showConfigArea, configButtons, selectedItem, setSelectedItem,
        onSwitchConfigArea, getNewGroupSelectProps
    } = useEditor()
    // 分组标题
    const [groupTitle, setGroupTitle] = useState('')
    // 是否调整了排序
    const [sortChanged, setSortChanged] = useState(false)
    // 移动端搜索框引用
    const mobileSearchInputRef = useRef<HTMLInputElement>(null)
    // 移动端搜索框是否显示
    const [searchVisible, setSearchVisible] = useState(false)
    // 搜索关键字
    const [keyword, setKeyword] = useState('')
    // 是否完成登录了
    const groupUnlocked = useMemo(() => {
        const groupInfo = groupList.find(item => item.id === selectedGroup)
        return !groupInfo?.requireLogin || hasGroupLogin(jwtPayload, selectedGroup)
    }, [groupList, selectedGroup, jwtPayload])

    // 添加新的凭证
    const onAddCertificate = async (certificateId: number | undefined) => {
        clearSearch()
        setDetailVisible(true)
        setShowCertificateId(certificateId)
    }

    // 回调 - 凭证详情关闭
    const onDetailClose = (needRefresh: boolean) => {
        needRefresh && refetchCertificateList()
        setDetailVisible(false)
    }

    useEffect(() => {
        const groupInfo = groupList.find(item => item.id === selectedGroup)
        setGroupTitle(groupInfo?.name || '未命名分组')
    }, [selectedGroup])

    // 更新用户输入的分组名
    const onSubmitGroupTitle = async () => {
        if (!groupTitle) {
            const groupInfo = groupList.find(item => item.id === selectedGroup)
            setGroupTitle(groupInfo?.name || '未命名分组')
            return    
        }

        await updateGroupName(selectedGroup, groupTitle)
        refetchGroupList()
    }

    // 经过搜索关键字筛选的列表项
    // 显示在页面上的是这个
    const searchedCertificateList = useMemo(() => {
        if (!certificateList) return []
        if (!keyword) return certificateList

        const lowerKeyword = keyword.toLowerCase()
        return certificateList.filter(item => item.name.toLowerCase().includes(lowerKeyword))
    }, [certificateList, keyword])

    // 排序变更
    const changeCertificateSort = (certificateList: CertificateListItem[]) => {
        queryClient.setQueryData(['group', selectedGroup, 'certificates'], (oldList: CertificateListItem[] | undefined) => {
            if (!oldList) return certificateList

            // 是否有数据变更，因为拖动排序组件在刚获取到数据时也会触发一次本方法
            // 所以需要把不必要的更新剪掉
            const noChange = oldList.map(item => item.id).join(',') === certificateList.map(item => item.id).join(',')
            if (noChange) return oldList

            setSortChanged(true)
            return certificateList
        })
    }

    const onSaveSort = async () => {
        if (!certificateList) {
            Notify.show({ type: 'danger', message: '获取凭证列表失败，请刷新后重试' })
            return
        }

        await updateCertificateSort(certificateList.map(item => item.id))
        setSortChanged(false)
        Notify.show({ type: 'success', message: '排序已保存' })
        refetchCertificateList()
    }

    // 渲染操作按钮
    const renderConfigButton = (item: ConfigButtonProps) => {
        return (
            <div
                key={item.label}
                className='
                    flex flex-col justify-center items-center p-4 select-none 
                    hover:bg-slate-300 hover:dark:bg-slate-600 transition rounded-lg cursor-pointer
                    active:scale-90 min-w-[88px]
                '
                onClick={item.onClick}
            >
                {item.icon}
                <span className='text-gray-600 dark:text-gray-200 text-sm'>
                    {item.label}
                </span>
            </div>
        )
    }

    // 渲染凭证列表项右侧的标记
    const renderRightMark = (item: CertificateListItem) => {
        // 编辑模式下右侧的小方块
        if (showConfigArea) return (
            <div className={
                'sort-handle absolute h-4 w-4 right-4 top-[38%] text-white ' +
                'ring rounded transition group-hover:ring-slate-500 dark:group-hover:ring-slate-200 ' +
                (selectedItem[item.id] ? 'bg-slate-500 dark:bg-slate-200 ring-slate-500 dark:ring-slate-200' : 'ring-slate-300')
            }></div>
        )

        if (item.markColor) return (
            <div
                className='absolute h-4 w-4 right-4 top-[38%] rounded-full'
                style={{ backgroundColor: item.markColor }}
            ></div>
        )

        return null
    }

    // 渲染凭证列表项
    const renderCertificateItem = (item: CertificateListItem) => {
        return (
            <div key={item.id} className="mx-2 mb-4 w-col-1 lg:w-col-2 xl:w-col-3">
                <div
                    className={
                        'select-none bg-white dark:bg-slate-700 dark:text-gray-200 relative rounded-lg py-2 px-4 ' +
                        'cursor-pointer group ' +
                        'ring-slate-500 dark:ring-slate-600 active:bg-slate-200 transition ' +
                        (selectedItem[item.id] ? 'ring' : 'hover:ring')
                    }
                    onClick={() => {
                        if (showConfigArea) setSelectedItem(old => ({ ...old, [item.id]: !old[item.id]}))
                        else onAddCertificate(item.id)
                    }}
                >
                    <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                    <div className='text-gray-600 dark:text-gray-400'>{item.updateTime}</div>
                    {renderRightMark(item)}
                </div>
            </div>
        )
    }

    const renderNoticeInfo = () => {
        if (!noticeInfo || noticeInfo.unReadNoticeCount <= 0) return null
        const config = noticeConfig[noticeInfo.unReadNoticeTopLevel]
        return (
            <Link to="/securityEntry">
                <div className={'m-4 px-4 py-2 text-white rounded-lg ' + config.bg}>
                    有 {noticeInfo.unReadNoticeCount} 条未读安全通知，点此查看
                </div>
            </Link>
        )
    }

    const renderCertificateList = () => {
        if (!groupUnlocked) return <GroupLogin ref={groupUnlockRef} />

        if (!certificateList || certificateListLoading) return (
            <div className='flex justify-center items-center text-gray-400 dark:text-gray-300 w-full mt-16 select-none'>
                <Loading className='mr-2' /> 加载中，请稍后...
            </div>
        )
        if (certificateList.length === 0) return (
            <div className='flex justify-center items-center text-gray-400 dark:text-gray-300 w-full mt-16 select-none'>
                暂无密码
            </div>
        )
        return (
            <ReactSortable
                animation={100}
                handle=".sort-handle"
                list={searchedCertificateList}
                setList={changeCertificateSort}
                className='mt-4 mx-2 flex flex-wrap justify-start'
            >
                {searchedCertificateList.map(renderCertificateItem)}
            </ReactSortable>
        )
    }

    // 清空搜索项
    // 需要主动触发，不能在输入框失去焦点时触发，因为搜索时可能会有查看凭证或者滚动的操作
    // 这时候失去焦点会导致搜索项被清空，会影响搜索体验 
    const clearSearch = () => {
        setSearchVisible(false)
        setKeyword('')
    }

    const renderSearchBtn = () => {
        return (
            <ActionIcon onClick={() => {
                setSearchVisible(!searchVisible)
                !searchVisible && mobileSearchInputRef.current?.focus()
            }}>
                {searchVisible ? <ArrowDown fontSize={24} /> : <Search fontSize={24} />}
            </ActionIcon>
        )
    }

    const renderConfirmBtn = () => {
        if (!groupUnlocked) return (
            <ActionButton onClick={() => groupUnlockRef.current?.unlock()}>
                解 锁
            </ActionButton>
        )

        if (sortChanged) return (
            <ActionButton onClick={onSaveSort}>
                保存排序
            </ActionButton>
        )

        return (
            <ActionButton onClick={() => onAddCertificate(undefined)}>
                新建密码
            </ActionButton>
        )
    }

    return (
        <div>
            <PageContent>
                <Header>
                    <div className='my-2 md:my-0 grow shrink ml-2 overflow-hidden'>
                        <input
                            className='w-full text-lg text-ellipsis bg-inherit whitespace-nowrap overflow-hidden'
                            onChange={e => setGroupTitle(e.target.value)}
                            onBlur={onSubmitGroupTitle}
                            disabled={!groupUnlocked}
                            onKeyUp={e => {
                                if (e.key === 'Enter') (e.target as HTMLElement).blur()
                            }}
                            placeholder='请输入分组名称'
                            value={groupTitle}
                        ></input>
                    </div>
                    {groupUnlocked && (
                        <div className='shrink-0 items-center flex flex-nowrap'>
                            <input
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                placeholder="搜索"
                                className={'hidden md:block px-3 text-base min-h-[38px] mx-2 bg-white dark:text-gray-200 dark:bg-slate-600 ' +
                                'md:w-[100px] lg:w-[200px] focus:md:w-[200px] focus:lg:w-[350px] ' +
                                'border border-solid dark:border-slate-700 rounded-md shadow-sm placeholder-slate-400 transition ' +
                                'hover:bg-slate-100 hover:dark:bg-slate-500 focus:outline-none focus:bg-slate-100 transition-w '}
                            />
                            <MoreO
                                fontSize={24}
                                className='cursor-pointer mx-2 hover:opacity-75'
                                onClick={() => {
                                    clearSearch()
                                    onSwitchConfigArea()
                                }}
                            />
                            <Button
                                className='!hidden md:!block !mx-2'
                                color={config?.buttonColor}
                                icon={sortChanged ? <Success fontSize={12} /> : <Plus fontSize={12} />}
                                onClick={sortChanged ? onSaveSort : () => onAddCertificate(undefined)}
                            >
                                {sortChanged ? '保存排序' : '新建密码'}
                            </Button>
                        </div>
                    )}
                </Header>

                <div
                    className={
                        'flex flex-row justify-center transition-h overflow-hidden ' +
                        (showConfigArea ? 'mt-4 h-[90px]' : 'h-0')
                    }>
                    {configButtons.map(renderConfigButton)}
                </div>

                {/* 移动端下的搜索框，桌面端时不显示 */}
                <div
                    className={
                        'md:hidden block transition-h overflow-hidden px-4 w-full ' +
                        (searchVisible ? 'mt-4 h-[38px]' : 'h-0')
                    }>
                    <input
                        ref={mobileSearchInputRef}
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        placeholder="搜索"
                        className={'px-3 text-base min-h-[38px] w-full bg-white dark:text-gray-200 dark:bg-slate-600 ' +
                        'border border-solid rounded-md shadow-sm placeholder-slate-400 '}
                    />
                </div>

                {renderNoticeInfo()}
                {renderCertificateList()}

                {showConfigArea &&
                <div className='w-full text-center text-gray-500 dark:text-gray-400 cursor-default mb-4 text-sm'>
                    拖动右侧小方块可以进行排序
                </div>}
            </PageContent>

            <CertificateDetail
                visible={detailVisible}
                onClose={onDetailClose}
                groupId={selectedGroup}
                certificateId={showCertificateId}
            />

            <Dialog {...getNewGroupSelectProps()} />

            <PageAction>
                <ActionIcon href='/Setting'>
                    <SettingO fontSize={24} />
                </ActionIcon>
                {renderSearchBtn()}
                <div onClick={clearSearch}>
                    <GroupSelectSheet />
                </div>
                {renderConfirmBtn()}
            </PageAction>
        </div>
    )
}

export default CertificateList