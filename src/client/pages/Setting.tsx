import { CertificateGroup } from '@/types/app'
import { sha } from '@/utils/common'
import { nanoid } from 'nanoid'
import React, { useContext, FC } from 'react'
import { Card, Cell, Form, Notify, Space, Switch } from 'react-vant'
import { Button } from '@/client/components/Button'
import { ArrowDown, ArrowLeft, Contact, Close, GemO, LikeO, ManagerO, StarO } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { ActionButton, ActionIcon, PageAction, PageContent } from '../components/PageWithAction'
import { addGroup } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import router from '@/server/router'
import { Statistic } from '../components/Statistic'

interface GroupForm {
    name: string
    password?: string
    passwordConfirm?: string
}

const SettingPage = () => {
    const { setGroupList, setSelectedGroup } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const [form] = Form.useForm<GroupForm>()
    const navigate = useNavigate()

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
                                    <Statistic label="分组数量" value={111} />
                                    <Statistic label="凭证数量" value={222} />
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
                            <Cell title="关于" icon={<LikeO />} isLink />
                        </Card>

                        <Card round>
                            <Cell title="登出" icon={<Close />} isLink />
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