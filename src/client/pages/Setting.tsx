import React, { useContext } from 'react'
import { Card, Cell, Space, Switch } from 'react-vant'
import { Contact, Close, LikeO, StarO, ArrowLeft, Certificate, SendGiftO, EcardPay } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { useNavigate } from '../Route'
import { Statistic } from '../components/Statistic'
import { useQuery } from 'react-query'
import { fetchCountInfo, setAppTheme } from '../services/user'
import { AppTheme } from '@/types/app'
import { useLogout } from '../components/LoginAuth'

const SettingPage = () => {
    const { userProfile, setUserProfile } = useContext(UserContext)
    const onLogout = useLogout()
    const navigate = useNavigate()
    // 数量统计接口
    const { data: countInfo } = useQuery('/getCountInfo', fetchCountInfo)

    const onSwitchDark = () => {
        const newTheme = userProfile?.theme === AppTheme.Light ? AppTheme.Dark : AppTheme.Light
        setAppTheme(newTheme)
        setUserProfile?.(old => {
            if (!old) return old
            return { ...old, theme: newTheme }
        })
    }

    return (
        <div>
            <PageContent>
                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 2xl:w-1/3 mt-4'>
                    <Space direction="vertical" gap={16} className='w-full'>
                        <Card round>
                            <Card.Body>
                                <div className="flex flex-row justify-around">
                                    <Statistic label="分组数量" value={countInfo?.group || '---'} />
                                    <Statistic label="凭证数量" value={countInfo?.certificate || '---'} />
                                </div>
                            </Card.Body>
                        </Card>

                        <Card round>
                            <Cell title="修改密码" icon={<Contact />} isLink onClick={() => navigate('/ChangePassword')} />
                            <Cell title="动态验证码" icon={<Certificate />} isLink onClick={() => navigate('/OtpManage')} />
                            <Cell title="分组管理" icon={<SendGiftO />} isLink onClick={() => navigate('/GroupManage')} />
                            <Cell title="新密码生成" icon={<EcardPay />} isLink onClick={() => navigate('/CreatePwdSetting')} />
                            <Cell title="黑夜模式" icon={<StarO />} 
                                rightIcon={<Switch
                                    size={24}
                                    defaultChecked={userProfile?.theme === AppTheme.Dark}
                                    onChange={onSwitchDark}
                                />}
                            />
                            <Cell title="关于" icon={<LikeO />} isLink onClick={() => navigate('/About')} />
                        </Card>

                        <Card round>
                            <Cell title="登出" icon={<Close />} isLink onClick={onLogout} />
                        </Card>
                    </Space>
                </div>
            </PageContent>

            <PageAction>
                <ActionIcon onClick={() => navigate(-1)}>
                    <ArrowLeft fontSize={24} />
                </ActionIcon>
                <ActionButton onClick={() => navigate('/securityEntry')}>安全管理</ActionButton>
            </PageAction>
        </div>
    )
}

export default SettingPage