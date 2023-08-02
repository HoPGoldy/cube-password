import React, { FC, MouseEventHandler, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageContent, PageAction } from '../../layouts/pageWithAction'
import Loading from '../../layouts/loading'
import { Image, Modal } from 'antd'
import { PageTitle } from '@/client/components/pageTitle'
import { useQueryDiaryList } from '@/client/services/diary'
import { DiaryListItem } from './listItem'
import { useOperation } from './operation'
import s from './styles.module.css'
import { CertificateDetail } from './detail'

/**
 * 凭证列表
 */
const CertificateList: FC = () => {
    const { month } = useParams()
    /** 获取日记列表 */
    const { data: monthListResp, isLoading } = useQueryDiaryList(month)
    /** 详情弹窗展示的密码 ID（-1 时代表新增密码） */
    const [detailId, setDetailId] = useState<number>()
    /** 底部操作栏 */
    const { renderMobileBar, renderTitleOperation } = useOperation({
        onAddNew: () => setDetailId(-1),
    })

    const renderContent = () => {
        if (isLoading) return <Loading />

        return (
            <div className={s.listContainer}>
                {monthListResp?.data?.map(item => <DiaryListItem key={item.date} item={item} />)}
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

            <CertificateDetail groupId detailId={detailId} onCancel={() => setDetailId(false)} />
        </PageContent>

        <PageAction>
            {renderMobileBar()}
        </PageAction>
    </>)
}

export default CertificateList