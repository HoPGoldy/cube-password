import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../store'

const JumpToDefaultDataEntry = () => {
    // 跳转到默认分组
    const defaultGroupId = useAppSelector(s => s.user.userInfo?.defaultGroupId)

    return (
        <Navigate to={`/group/${defaultGroupId}`} replace />
    )
}

export default JumpToDefaultDataEntry