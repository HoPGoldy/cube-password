import { sha } from '@/utils/crypto'
import React, { FC, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useCreateAdmin } from '@/client/services/user'
import { getIsMobile, stateAppConfig } from '@/client/store/global'
import { Button, Row, Col, Input, InputRef } from 'antd'
import { messageError, messageSuccess } from '@/client/utils/message'
import s from './styles.module.css'
import { PageTitle } from '@/client/components/pageTitle'
import { nanoid } from 'nanoid'
import { useAtomValue, useSetAtom } from 'jotai'

const getViewWidth = () => {
    // 获取浏览器宽度
    const width = window.innerWidth
    const isMobile = getIsMobile()

    if (isMobile) {
        return width * 0.8 + 'px'
    }
    else {
        return width / 3 + 'px'
    }
}

const viewWidth = getViewWidth()

const Register: FC = () => {
    // 密码输入框
    const passwordInputRef = useRef<InputRef>(null)
    // 重复密码输入框
    const repeatPasswordInputRef = useRef<InputRef>(null)
    // 密码
    const [password, setPassword] = useState('')
    // 密码错误提示
    const [pwdError, setPwdError] = useState('')
    // 重复密码
    const [repeatPassword, setRepeatPassword] = useState('')
    // 重复密码错误提示
    const [repeatPwdError, setRepeatPwdError] = useState('')
    // 提交注册
    const { mutateAsync: createAdmin, isLoading: isCreating } = useCreateAdmin()
    // 是否需要初始化，初始化完成后这个值就变成 false 了
    const needInit = useAtomValue(stateAppConfig)?.needInit
    // 轮播框宽度
    const viewCarouselRef = useRef<HTMLDivElement>(null)
    // 轮播位置
    const [swiperIndex, setSwiperIndex] = useState(0)
    /** 更新初始化状态 */
    const setAppConfig = useSetAtom(stateAppConfig)

    const onInputedPassword = () => {
        if (password.length < 6) {
            messageError('密码长度应大于 6 位')
            return
        }
        setSwiperIndex(1)
        setTimeout(() => {
            repeatPasswordInputRef.current?.focus()
        }, 600)
    }

    const onInputedRepeatPassword = () => {
        if (repeatPassword !== password) {
            messageError('两次密码不一致')
            return
        }
        setSwiperIndex(2)
    }

    const onSubmit = async () => {
        const salt = nanoid(128)
        const resp = await createAdmin({ code: sha(salt + password), salt })
        if (resp.code !== 200) return

        messageSuccess('初始化完成')
        setAppConfig(old => {
            if (!old) return old
            return { ...old, needInit: false }
        })
    }

    if (!needInit) {
        return (
            <Navigate to='/login' replace />
        )
    }

    const getViewStyle = (index: number): React.CSSProperties => ({
        width: viewWidth,
        display:'inline-block',
        verticalAlign: 'top',
        opacity: swiperIndex === index ? 1 : 0,
    })

    return (
        <div className="h-screen w-screen bg-gray-100 flex flex-col flex-nowrap items-center">
            <PageTitle title='应用初始化' />
            <header className="text-5xl font-bold text-mainColor mt-36 w-full text-center">应用初始化</header>
            <div className="overflow-hidden mt-4" style={{ width: viewWidth }} ref={viewCarouselRef}>
                <div
                    className="transition-all"
                    style={{
                        width: `calc(${viewWidth} * 4)`,
                        transform: `translate(calc(-${viewWidth} * ${swiperIndex}))`,
                    }}
                >
                    <div style={getViewStyle(0)}>
                        <div className={s.subTitle}>
                            设置主密码
                            <div className={s.description}>
                                主密码是访问应用的唯一凭证，请设置一个至少 6 位的强密码，并牢记在心。
                                <br />
                                不要使用生日、姓名缩写等常见信息。
                            </div>
                        </div>
                        <Row gutter={[8, 8]} justify="center">
                            <Col span={17}>
                                <Input.Password
                                    ref={passwordInputRef}
                                    size="large"
                                    placeholder="请输入密码"
                                    value={password}
                                    onChange={e => {
                                        setPassword(e.target.value)
                                        if (pwdError) setPwdError('')
                                        if (repeatPwdError) setRepeatPwdError('')
                                        if (repeatPassword) setRepeatPassword('')
                                    }}
                                    onKeyUp={e => {
                                        if (e.key === 'Enter') onInputedPassword()
                                    }}
                                />
                            </Col>
                            <Col span={7} xl={5} xxl={4}>
                                <Button
                                    disabled={!password || isCreating}
                                    type='primary'
                                    block
                                    size="large"
                                    onClick={onInputedPassword}
                                >下一步</Button>
                            </Col>
                        </Row>
                    </div>
                    <div style={getViewStyle(1)}>
                        <div className={s.subTitle}>
                            重复密码
                            <div className={s.description}>
                                隐私数据将使用该密码加密。因此，主密码一旦丢失，所有的数据都将 <b>无法找回</b>。
                            </div>
                        </div>
                        <Row gutter={[8, 8]} justify="center">
                            <Col span={17}>
                                <Input.Password
                                    ref={repeatPasswordInputRef}
                                    size="large"
                                    placeholder="重复密码"
                                    value={repeatPassword}
                                    onChange={e => {
                                        setRepeatPassword(e.target.value)
                                        if (repeatPwdError) setRepeatPwdError('')
                                    }}
                                    onKeyUp={e => {
                                        if (e.key === 'Enter') onInputedRepeatPassword()
                                    }}
                                />
                            </Col>
                            <Col span={7} xl={5} xxl={4}>
                                <Button
                                    disabled={!repeatPassword || isCreating}
                                    type='primary'
                                    block
                                    size="large"
                                    onClick={onInputedRepeatPassword}
                                >下一步</Button>
                            </Col>
                        </Row>
                        <Row justify="center" className="mt-2">
                            <Col span={4}>
                                <Button
                                    block
                                    onClick={() => setSwiperIndex(0)}
                                    type="text"
                                >返回</Button>
                            </Col>
                        </Row>
                    </div>
                    <div style={getViewStyle(2)}>
                        <div className={s.subTitle}>
                            告知
                            <div className={s.description}>
                                本应用不会在任何地方使用、分析或明文存储你的信息。
                                <br />
                                你可以使用浏览器的隐私模式进行访问来提高安全性。
                                <br />
                                该页面不会再次出现，请确保 <b>主密码已可靠保存</b> 后点击下方按钮。
                            </div>
                        </div>
                        <Row gutter={[8, 8]} justify="center">
                            <Col span={17}>
                                <Button
                                    loading={isCreating}
                                    type='primary'
                                    block
                                    size="large"
                                    onClick={onSubmit}
                                >完成初始化</Button>
                            </Col>
                        </Row>
                        <Row justify="center" className="mt-2">
                            <Col span={4}>
                                <Button
                                    block
                                    onClick={() => setSwiperIndex(1)}
                                    type="text"
                                >返回</Button>
                            </Col>
                        </Row>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Register