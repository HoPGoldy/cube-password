import React, { useContext, useState, ReactElement, useEffect } from 'react'
import { Button } from '@/client/components/Button'
import { Dialog, Loading } from 'react-vant'
import { ArrowLeft, SettingO } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { CertificateListItem } from '@/types/http'
import CertificateDetail from '../components/CertificateDetail'
import { useEditor } from './CertificateList.hook'
import { updateGroup } from '../services/certificateGroup'

interface ConfigButtonProps {
    onClick: () => void
    icon: ReactElement
    label: string
}

const CertificateList = () => {
    const {
        certificateList, groupList, selectedGroup, certificateListLoading,
        refetchCertificateList, refetchGroupList
    } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
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

    // 添加新的凭证
    const onAddCertificate = async (certificateId: number | undefined) => {
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

        await updateGroup(selectedGroup, { name: groupTitle })
        refetchGroupList()
    }

    // 渲染操作按钮
    const renderConfigButton = (item: ConfigButtonProps) => {
        return (
            <div
                key={item.label}
                className='
                    flex flex-col justify-center items-center p-4 select-none 
                    hover:bg-slate-300 transition rounded-lg cursor-pointer
                    active:scale-90 min-w-[88px]
                '
                onClick={item.onClick}
            >
                {item.icon}
                <span className='text-gray-600 text-sm'>
                    {item.label}
                </span>
            </div>
        )
    }

    // 渲染凭证列表项
    const renderCertificateItem = (item: CertificateListItem) => {
        return (
            <div
                key={item.id}
                className={
                    'mx-2 mb-4 pr-4 select-none bg-white relative rounded-lg py-2 px-4 ' +
                    'w-col-1 lg:w-col-2 xl:w-col-3 cursor-pointer group ' +
                    'ring-slate-500 active:bg-slate-200 transition ' +
                    (selectedItem[item.id] ? 'ring' : 'hover:ring')
                }
                onClick={() => {
                    if (showConfigArea) setSelectedItem(old => ({ ...old, [item.id]: !old[item.id]}))
                    else onAddCertificate(item.id)
                }}
            >
                <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                <div className='text-gray-600'>{item.updateTime}</div>
                {/* 编辑模式下右侧的小方块 */}
                {showConfigArea && (
                    <div className={
                        'absolute h-4 w-4 right-4 top-[38%] text-white ' +
                        'ring rounded transition group-hover:ring-slate-500 ' +
                        (selectedItem[item.id] ? 'bg-slate-500 ring-slate-500' : 'ring-slate-300')
                    }></div>
                )}
            </div>
        )
    }

    const renderCertificateList = () => {
        if (!certificateList || certificateListLoading) return (
            <div className='flex justify-center items-center text-gray-400 w-full mt-16 select-none'>
                <Loading className='mr-2' /> 加载中，请稍后...
            </div>
        )
        if (certificateList.length === 0) return (
            <div className='flex justify-center items-center text-gray-400 w-full mt-16 select-none'>
                暂无密码
            </div>
        )
        return (
            <div className='mt-4 mx-2 flex flex-wrap justify-start'>
                {certificateList.map(renderCertificateItem)}
            </div>
        )
    }

    return (
        <div>
            <PageContent>
                <Header>
                    <div className='grow shrink ml-2 overflow-hidden flex flex-col justify-center'>
                        {/* <div
                            className='text-lg md:text-ellipsis md:whitespace-nowrap md:overflow-hidden'
                            title={groupTitle}
                        >
                            {groupTitle}
                        </div> */}
                        <input
                            className='text-lg md:text-ellipsis md:whitespace-nowrap md:overflow-hidden'
                            onChange={e => setGroupTitle(e.target.value)}
                            onBlur={onSubmitGroupTitle}
                            onKeyUp={e => {
                                if (e.key === 'Enter') (e.target as HTMLElement).blur()
                            }}
                            placeholder='请输入分组名称'
                            value={groupTitle}
                        ></input>
                    </div>
                    <div className='shrink-0 items-center flex flex-nowrap'>
                        <SettingO
                            fontSize={24}
                            className='cursor-pointer mx-2 hover:opacity-75'
                            onClick={onSwitchConfigArea}
                        />
                        <Button
                            className='!hidden md:!block !mx-2'
                            color={config?.buttonColor}
                            onClick={() => onAddCertificate(undefined)}
                        >
                            + 新建密码
                        </Button>
                    </div>
                </Header>

                <div
                    className={
                        'flex flex-row justify-center transition-h overflow-hidden ' +
                        (showConfigArea ? 'mt-4 h-[90px]' : 'h-0')
                    }>
                    {configButtons.map(renderConfigButton)}
                </div>

                {renderCertificateList()}

                <CertificateDetail
                    visible={detailVisible}
                    onClose={onDetailClose}
                    groupId={selectedGroup}
                    certificateId={showCertificateId}
                />

                <Dialog {...getNewGroupSelectProps()} />
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={() => onAddCertificate(undefined)}>新建密码</ActionButton>
            </PageAction>
        </div>
    )
}

export default CertificateList