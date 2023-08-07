import React, { FC, MouseEventHandler, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageContent, PageAction } from '../../layouts/pageWithAction'
import Loading from '../../layouts/loading'
import { Image, List, Modal } from 'antd'
import { PageTitle } from '@/client/components/pageTitle'
import { useQueryDiaryList } from '@/client/services/diary'
import { DiaryListItem } from './listItem'
import { useOperation } from './operation'
import s from './styles.module.css'
import { CertificateDetail } from './detail'
import { useCertificateList } from '@/client/services/certificate'

/**
 * 凭证列表
 */
const CertificateList: FC = () => {
    const { month, groupId } = useParams()
    /** 详情弹窗展示的密码 ID（-1 时代表新增密码） */
    const [detailId, setDetailId] = useState<number>()
    /** 获取密码列表 */
    const { data: certificateListResp, isLoading } = useCertificateList(Number(groupId))
    console.log("🚀 ~ file: index.tsx:23 ~ certificateListResp:", certificateListResp)
    /** 底部操作栏 */
    const { renderMobileBar, renderTitleOperation } = useOperation({
        onAddNew: () => setDetailId(-1),
    })

    if (!groupId) return (
        <div>未知分组，请刷新重试</div>
    )

    const renderContent = () => {
        if (isLoading) return <Loading />

        return (
            <div className={s.listContainer}>
                <List
                    grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
                    dataSource={certificateListResp?.data || []}
                    renderItem={renderInviteItem}
                />
            </div>
        )
    }

    return (<>
        <PageTitle title='凭证列表' />

        <PageContent>
            <div className="mx-4 mt-4">
                <div className="flex flex-row flex-nowrap justify-end items-center">
                    {renderTitleOperation()}
                </div>
                {renderContent()}
            </div>

            <CertificateDetail groupId={+groupId} detailId={detailId} onCancel={() => setDetailId(undefined)} />
        </PageContent>

        <PageAction>
            {renderMobileBar()}
        </PageAction>
    </>)
}

export default CertificateList