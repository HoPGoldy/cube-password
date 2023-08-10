import React, { FC, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageContent, PageAction } from '../../layouts/pageWithAction'
import Loading from '../../layouts/loading'
import { Button, Card, Checkbox, Empty, Result } from 'antd'
import { PageTitle } from '@/client/components/pageTitle'
import { useOperation } from './operation'
import s from './styles.module.css'
import { CertificateDetail } from './detail'
import { useCertificateList } from '@/client/services/certificate'
import { CertificateListItem } from '@/types/group'
import { MARK_COLORS_MAP } from '@/client/components/colorPicker'
import { useGroupInfo } from '@/client/store/user'
import { useGroupLock } from './hooks/useGroupLock'
import { useAtomValue } from 'jotai'
import { stateAppConfig } from '@/client/store/global'

/**
 * 凭证列表
 */
const CertificateList: FC = () => {
    const { groupId: groupIdStr } = useParams()
    const groupId = Number(groupIdStr)
    /** 详情弹窗展示的密码 ID（-1 时代表新增密码） */
    const [detailId, setDetailId] = useState<number>()
    /** 分组是否解密了 */
    const groupInfo = useGroupInfo(groupId)
    /** 获取凭证列表 */
    const { data: certificateListResp, isLoading } = useCertificateList(groupId, !groupInfo?.requireLogin)
    /** 操作栏功能 */
    const operation = useOperation({
        certificateList: certificateListResp?.data ?? [],
        onAddNew: () => setDetailId(-1),
        groupId,
    })
    /** 主题色 */
    const primaryColor = useAtomValue(stateAppConfig)?.primaryColor
    /** 分组登录功能 */
    const { renderGroupLogin } = useGroupLock({ groupId })

    if (!groupId || !groupInfo) return (
        <Result
            status="warning"
            title="未知分组"
            subTitle="请检查链接是否正确，或者点击下方按钮返回默认分组"
            extra={
                <Link to="/">
                    <Button key="console">
                        返回首页
                    </Button>
                </Link>
            }
        />
    )

    // 渲染凭证列表项右侧的标记
    const renderRightMark = (item: CertificateListItem) => {
        // 编辑模式下右侧的小方块
        if (operation.selectMode) return (
            <Checkbox
                className='absolute h-4 w-4 right-4 top-[30%] scale-150'
                checked={operation.selectedItem[item.id]}
            ></Checkbox>
        )

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
                style={{ borderColor: operation.selectedItem[item.id] ? primaryColor : undefined }}
                onClick={() => {
                    if (!operation.selectMode) setDetailId(item.id)
                    else operation.setSelectedItem(old => ({ ...old, [item.id]: !old[item.id]}))
                }}
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

    const renderList = () => {
        if (!certificateListResp?.data || certificateListResp?.data?.length === 0) {
            return (
                <Empty
                    className='m-auto mt-[20vh]'
                    description={
                        <div className='text-gray-500 cursor-default'>暂无凭证，点击右上角按钮创建</div>
                    }
                />
            )
        }

        return certificateListResp?.data?.map(renderCertificateItem)
    }

    const renderContent = () => {
        if (groupInfo?.requireLogin) return renderGroupLogin()
        if (isLoading) return <Loading />

        return (
            <div className="mx-4 mt-4">
                {operation.renderTitleOperation()}
                <div className='mt-4 flex flex-wrap justify-start'>
                    {renderList()}
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
            {operation.renderMobileBar()}
        </PageAction>
    </>)
}

export default CertificateList