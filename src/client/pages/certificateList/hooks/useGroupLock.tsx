import { useIsMobile } from '@/client/layouts/responsive'
import { logout, stateGroupList } from '@/client/store/user'
import { messageSuccess, messageWarning } from '@/client/utils/message'
import { sha } from '@/utils/crypto'
import { Form, Row, Col, Input, Modal, Button, Result } from 'antd'
import React, { useState } from 'react'
import { useAddGroup, useUnlockGroup } from '@/client/services/group'
import { nanoid } from 'nanoid'
import { CertificateGroupStorage } from '@/types/group'
import { useAtomValue, useSetAtom } from 'jotai'
import { useNavigate } from 'react-router-dom'
import { LockOutlined } from '@ant-design/icons'
import { queryChallengeCode } from '@/client/services/global'

interface useGroupLockProps {
    groupId: number
}

export const useGroupLock = (props: useGroupLockProps) => {
    const { groupId } = props
    const [password, setPassword] = useState('')
    const groupList = useAtomValue(stateGroupList)
    /** 输入框错误提示 */
    const [passwordError, setPasswordError] = useState(false)
    /** 请求 - 解密分组 */
    const { mutateAsync: runUnlockGroup } = useUnlockGroup(groupId)

    const onLogin = async () => {
        if (!password) {
            setPasswordError(true)
            return
        }

        const preResp = await queryChallengeCode()
        if (preResp.code !== 200 || !preResp.data) return

        const salt = groupList?.find(item => item.id === groupId)?.salt
        if (!salt) {
            messageWarning('分组数据异常，请刷新页面重试')
            return
        }

        const code = sha(sha(salt + password) + preResp.data)
        const resp = await runUnlockGroup(code)
        if (resp.code !== 200) return
        console.log("🚀 ~ file: useGroupLock.tsx:46 ~ onLogin ~ resp:", resp)
    }

    const renderGroupLogin = () => {
        return (
            <div className="mt-[15vh]">
                <Result
                    icon={<LockOutlined className="!text-gray-400" />}
                    title="分组已加密"
                    subTitle="输入正确密码后解锁，登出时分组将被重新锁定"
                    extra={
                        <div>
                            <div className="sm:w-full md:w-1/2 xl:w-1/3 2xl:w-1/4 m-auto">
                                <Row gutter={[16, 16]}>
                                    <Col span={24}>
                                        <Input.Password
                                            status={passwordError ? 'error' : undefined}
                                            placeholder='请输入分组密码'
                                            value={password}
                                            onChange={e => {
                                                setPassword(e.target.value)
                                                setPasswordError(false)
                                            }}
                                            onKeyUp={e => {
                                                if (e.key === 'Enter') onLogin()
                                            }}
                                        />
                                    </Col>
                                    <Col span={24}>
                                        <Button type="primary" block onClick={onLogin}>解锁</Button>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    }
                />
            </div>
        )
    }

    return { onLogin, renderGroupLogin }
}