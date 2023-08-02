import React, { useMemo } from 'react'
import { AppTheme } from '@/types/user'
import { changeTheme, getUserTheme, logout, stateUser } from '@/client/store/user'
import { useLogout, useQueryDiaryCount, useSetTheme } from '@/client/services/user'
import { LockOutlined, DatabaseOutlined, TagsOutlined, SmileOutlined } from '@ant-design/icons'
import { useAtomValue } from 'jotai'

export interface SettingLinkItem {
    label: string
    icon: React.ReactNode
    link: string
    onClick?: () => void
}

export const useSetting = () => {
    const userInfo = useAtomValue(stateUser)
    // 数量统计接口
    const { data: countInfo } = useQueryDiaryCount()
    /** 主题设置 */
    const { mutateAsync: setAppTheme } = useSetTheme()
    /** 登出接口 */
    const { mutateAsync: postLogout, isLoading: isLogouting } = useLogout()

    const settingConfig = useMemo(() => {
        const list = [
            { label: '修改密码', icon: <LockOutlined />, link: '/changePassword' },
            { label: '导入', icon: <DatabaseOutlined />, link: '/importDiary' },
            { label: '导出', icon: <TagsOutlined />, link: '/exportDiary' },
            { label: '关于', icon: <SmileOutlined />, link: '/about' },
        ].filter(Boolean) as SettingLinkItem[]

        return list
    }, [])

    const onSwitchTheme = () => {
        const newTheme = userInfo?.theme === AppTheme.Light ? AppTheme.Dark : AppTheme.Light
        setAppTheme(newTheme)
        changeTheme(newTheme)
    }

    const onLogout = async () => {
        await postLogout()
        logout()
    }

    const diaryCount = countInfo?.data?.diaryCount || '---'
    const diaryLength = countInfo?.data?.diaryLength || '---'
    const userTheme = getUserTheme(userInfo?.theme)

    return {
        diaryCount, diaryLength, onLogout, isLogouting, settingConfig,
        userTheme, onSwitchTheme
    }
}
