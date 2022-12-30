import React, { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Space, Cell } from 'react-vant'
import Header from '../components/Header'
import { PageContent, PageAction, ActionButton } from '../components/PageWithAction'

const About: FC = () => {
    const navigate = useNavigate()

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    关于
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 2xl:w-1/3 mt-4'>
                    <Space direction="vertical" gap={16} className='w-full'>
                        <Card round>
                            <Card.Body>
                                数据自托管的隐私信息管理工具。
                                <br /><br />
                                支持分组、分组加密、强密码生成等功能。并内建了一套安全模块，负责监控异常访问并及时提醒。
                            </Card.Body>
                        </Card>

                        <Card round>
                            <a href="mailto:hopgoldy@gmail.com?&subject=cube-diary 相关">
                                <Cell title="联系我" value="hopgoldy@gmail.com" />
                            </a>
                            <a href='https://github.com/HoPGoldy/keep-my-password' target="_blank" rel="noreferrer">
                                <Cell title="开源地址" value="github" />
                            </a>
                        </Card>
                    </Space>
                </div>

                <div className="text-center absolute w-full bottom-0 text-mainColor mb-0 md:mb-4 dark:text-gray-200">
                    Powered by 💗 Yuzizi
                </div>
            </PageContent>

            <PageAction>
                <ActionButton onClick={() => navigate(-1)}>返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default About