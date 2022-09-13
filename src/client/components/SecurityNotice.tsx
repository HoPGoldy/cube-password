import { SecurityNoticeType } from '@/types/app'
import { SecurityNoticeResp } from '@/types/http'
import React, { FC, useContext } from 'react'
// import { Notify } from 'react-vant'
import { toggleNoticeRead } from '../services/log'
import { UserContext } from './UserProvider'

interface Props {
    detail: SecurityNoticeResp
    onChange?: (detail: SecurityNoticeResp) => void
}

export const noticeConfig = {
    [SecurityNoticeType.Danger]: { ring: 'ring-red-500', bg: 'bg-red-500' },
    [SecurityNoticeType.Warning]: { ring: 'ring-orange-500', bg: 'bg-orange-500' },
    [SecurityNoticeType.Info]: { ring: 'ring-sky-500', bg: 'bg-sky-500' },
}

export const SecurityNotice: FC<Props> = (props) => {
    const { setNoticeInfo } = useContext(UserContext)
    const { detail, onChange } = props
    const color = noticeConfig[detail.type]

    const onClick = async () => {
        const data = await toggleNoticeRead(detail.id, !detail.isRead)
        setNoticeInfo(data)
        onChange?.({ ...detail, isRead: !detail.isRead })
        // Notify.show({ type: 'success', message: '通知设置为' + (detail.isRead ? '未读' : '已读') })
    }

    return (
        <div key={detail.id} className={'bg-white dark:bg-slate-700 dark:text-gray-200 cursor-pointer rounded-lg m-4 hover:ring transition ' + color.ring + ' ' + (detail.isRead ? 'opacity-50' : '')} onClick={onClick}>
            <div className={'flex flex-nowrap justify-between text-white text px-4 py-2 rounded-tl-lg rounded-tr-lg ' + color.bg}>
                <span className='font-bold'>{detail.title}</span>
                <span>{detail.date}</span>
            </div>
            <div className='py-2 px-4'>
                {detail.content}
            </div>
        </div>
    )
}
