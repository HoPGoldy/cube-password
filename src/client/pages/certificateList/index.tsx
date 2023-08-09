import React, { FC, MouseEventHandler, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageContent, PageAction } from '../../layouts/pageWithAction'
import Loading from '../../layouts/loading'
import { Card, Image, List, Modal } from 'antd'
import { PageTitle } from '@/client/components/pageTitle'
import { useOperation } from './operation'
import s from './styles.module.css'
import { CertificateDetail } from './detail'
import { useCertificateList } from '@/client/services/certificate'
import { CertificateListItem } from '@/types/group'
import { MARK_COLORS_MAP } from '@/client/components/colorPicker'
import { useIsGroupUnlocked } from '@/client/store/user'
import { useGroupLock } from './hooks/useGroupLock'

/**
 * 凭证列表
 */
const CertificateList: FC = () => {
    const { groupId: groupIdStr } = useParams()
    const groupId = Number(groupIdStr)
    /** 详情弹窗展示的密码 ID（-1 时代表新增密码） */
    const [detailId, setDetailId] = useState<number>()
    /** 分组是否解密了 */
    const isGroupUnlock = useIsGroupUnlocked(groupId)
    /** 获取密码列表 */
    const { data: certificateListResp, isLoading } = useCertificateList(groupId, isGroupUnlock)
    /** 操作栏功能 */
    const { renderMobileBar, renderTitleOperation } = useOperation({
        onAddNew: () => setDetailId(-1),
    })
    /** 分组登录功能 */
    const { renderGroupLogin } = useGroupLock({ groupId })
    /** 列表编辑功能 */
    // const {
    //     showConfigArea, configButtons, selectedItem, setSelectedItem,
    //     onSwitchConfigArea, getNewGroupSelectProps
    // } = useEditor()

    if (!groupId) return (
        <div>未知分组，请刷新重试</div>
    )

    // 渲染凭证列表项右侧的标记
    const renderRightMark = (item: CertificateListItem) => {
        // 编辑模式下右侧的小方块
        // if (showConfigArea) return (
        //     <div className={
        //         'sort-handle absolute h-4 w-4 right-4 top-[38%] text-white ' +
        //         'ring rounded transition group-hover:ring-slate-500 dark:group-hover:ring-slate-200 ' +
        //         (selectedItem[item.id] ? 'bg-slate-500 dark:bg-slate-200 ring-slate-500 dark:ring-slate-200' : 'ring-slate-300')
        //     }></div>
        // )

        if (item.markColor) return (
            <div
                className='absolute h-4 w-4 right-4 top-[38%] rounded-full'
                style={{ backgroundColor: MARK_COLORS_MAP[item.markColor] }}
            ></div>
        )

        return null
    }

    // 渲染凭证列表项
    const renderCertificateItem = (item: CertificateListItem) => {
        return (
            <Card
                key={item.id}
                size="small"
                className={s.listItem}
                onClick={() => setDetailId(item.id)}
            >
                <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
                <div className='text-gray-600 dark:text-gray-400'>{item.updateTime}</div>
                {renderRightMark(item)}
            </Card>
            // <div key={item.id} className="mx-2 mb-4 w-col-1 lg:w-col-2 xl:w-col-3">
            //     <div
            //         className={
            //             'select-none bg-white dark:bg-slate-700 dark:text-gray-200 relative rounded-lg py-2 px-4 ' +
            //             'cursor-pointer group ' +
            //             'ring-slate-500 dark:ring-slate-600 active:bg-slate-200 transition '
            //             // (selectedItem[item.id] ? 'ring' : 'hover:ring')
            //         }
            //         // onClick={() => {
            //         //     if (showConfigArea) setSelectedItem(old => ({ ...old, [item.id]: !old[item.id]}))
            //         //     else onAddCertificate(item.id)
            //         // }}
            //     >
            //         <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>{item.name}</div>
            //         <div className='text-gray-600 dark:text-gray-400'>{item.updateTime}</div>
            //         {renderRightMark(item)}
            //     </div>
            // </div>
        )
    }

    const renderContent = () => {
        if (!isGroupUnlock) return renderGroupLogin()
        if (isLoading) return <Loading />

        return (
            <div className="mx-4 mt-4">
                <div className="flex flex-row flex-nowrap justify-end items-center">
                    {renderTitleOperation()}
                </div>
                <div className='mt-4 flex flex-wrap justify-start'>
                    {certificateListResp?.data?.map(renderCertificateItem)}
                </div>
            </div>
        )
    }

    return (<>
        <PageTitle title='凭证列表' />

        <PageContent>
            {renderContent()}
            <CertificateDetail groupId={+groupId} detailId={detailId} onCancel={() => setDetailId(undefined)} />
        </PageContent>

        <PageAction>
            {renderMobileBar()}
        </PageAction>
    </>)
}

export default CertificateList