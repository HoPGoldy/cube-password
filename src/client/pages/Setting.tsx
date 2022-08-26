import React, { useContext, useEffect } from 'react'
import { Card, Cell, Space, Switch } from 'react-vant'
import { Contact, Close, GemO, LikeO, StarO } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { AppConfigContext } from '../components/AppConfigProvider'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import router from '@/server/router'
import { Statistic } from '../components/Statistic'
import { setToken } from '../services/base'
import { useQuery } from 'react-query'
import { fetchCountInfo, requireChangePwd } from '../services/user'

const SettingPage = () => {
    const { setUserProfile } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    // 数量统计接口
    const { data: countInfo } = useQuery('/getCountInfo', fetchCountInfo)

    const onLogout = () => {
        setUserProfile(undefined)
        setToken(null)
        navigate('/login', { replace: true })
    }

    useEffect(() => {
        const fetch = async () => {
            const resp = await requireChangePwd()
            console.log('resp', resp)
        }
    
        fetch()
    }, [])
    

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    应用设置
                </Header>

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
                            <Link to="/securityEntry">
                                <Cell title="安全管理" icon={<GemO />} isLink />
                            </Link>
                            <Cell title="修改密码" icon={<Contact />} isLink />
                            <Cell title="黑夜模式" icon={<StarO />} 
                                rightIcon={<Switch
                                    size={24}
                                    // defaultChecked={userProfile?.darkTheme}
                                    // onChange={onSwitchDark}
                                />}
                            />
                            <Link to="/about">
                                <Cell title="关于" icon={<LikeO />} isLink />
                            </Link>
                        </Card>

                        <Card round>
                            <Cell title="登出" icon={<Close />} isLink onClick={onLogout} />
                        </Card>
                    </Space>
                </div>
            </PageContent>

            <PageAction>
                <ActionButton onClick={() => navigate(-1)}>返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default SettingPage