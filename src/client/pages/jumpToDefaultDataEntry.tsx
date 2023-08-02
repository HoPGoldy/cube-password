import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { stateUser } from '../store/user'

const JumpToDefaultDataEntry = () => {
    // 跳转到默认分组
    const defaultGroupId = useAtomValue(stateUser)?.defaultGroupId

    return (
        <Navigate to={`/group/${defaultGroupId}`} replace />
    )
}

export default JumpToDefaultDataEntry