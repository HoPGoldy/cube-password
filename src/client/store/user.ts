import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { AppTheme, FrontendUserInfo, LoginSuccessResp } from '@/types/user'
import { CertificateGroupDetail } from '@/types/group'

interface UserState {
    userInfo?: Omit<FrontendUserInfo, 'groups'>
    groupList: CertificateGroupDetail[]
    replayAttackSecret?: string
    token?: string
}

const initialState: UserState = {
    token: undefined,
    groupList: [],
}

export const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        login: (state, action: PayloadAction<LoginSuccessResp>) => {
            const { token, replayAttackSecret, groups, ...userInfo } = action.payload
            state.token = token
            state.replayAttackSecret = replayAttackSecret
            state.groupList = groups
            state.userInfo = userInfo
        },
        logout: (state) => {
            state.token = undefined
            state.replayAttackSecret = undefined
            state.userInfo = undefined
        },
        updateGroupList: (state, action: PayloadAction<CertificateGroupDetail[]>) => {
            state.groupList = action.payload
        },
        changeTheme: (state, action: PayloadAction<AppTheme>) => {
            if (!state.userInfo) return
            state.userInfo.theme = action.payload
            localStorage.setItem('cube-password-theme', action.payload)
        }
    },
})

export const { login, logout, updateGroupList, changeTheme } = userSlice.actions

/**
 * 从用户信息中获取主题色
 * 在用户信息没有获取到时，从 localStorage 和默认值获取
 */
export const getUserTheme = (userTheme?: AppTheme): AppTheme => {
    return userTheme
        || localStorage.getItem('cube-password-theme') as AppTheme
        || AppTheme.Light
}

export default userSlice.reducer
