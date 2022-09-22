import React, { useContext, useState } from 'react'
import { ReactSortable } from 'react-sortablejs'
import { Form, Notify, Popup } from 'react-vant'
import { Button } from '@/client/components/Button'
import { UserContext } from '../components/UserProvider'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { groupAddPassword, groupRemovePassword, requireOperate, setDefaultGroup, updateGroupSort } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from '../Route'
import Header from '../components/Header'
import { CertificateGroupDetail } from '@/types/http'
import { Field } from '../components/Field'
import { useQuery } from 'react-query'
import { fetchOtpInfo } from '../services/user'
import { sha } from '@/utils/crypto'

interface AddPasswordForm {
    password: string
    passwordConfirm: string
}

interface RemovePasswordForm {
    password: string
    code?: string
}

const GroupManage = () => {
    const { setGroupList, groupList, refetchGroupList, userProfile, setUserProfile } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()
    // 添加密码的 form 实例
    const [addPasswordForm] = Form.useForm<AddPasswordForm>()
    // 正在弹窗的添加密码详情
    const [addPasswordDetail, setAddPasswordDetail] = useState<CertificateGroupDetail | undefined>()
    // 移除密码的 form 实例
    const [removePasswordForm] = Form.useForm<RemovePasswordForm>()
    // 正在弹窗的移除密码详情
    const [removePasswordDetail, setRemovePasswordDetail] = useState<CertificateGroupDetail | undefined>()
    // 是否提交中
    const [submitting, setSubmitting] = useState(false)
    // 加载当前令牌信息
    const { data: otpInfo } = useQuery('fetchOtpInfo', fetchOtpInfo, {
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })

    /**
     * 回调 - 添加密码
     */
    const onSetPassword = async () => {
        if (!addPasswordDetail) {
            Notify.show({ type: 'warning', message: '添加失败，请刷新页面后再试' })
            return
        }
        const values = await addPasswordForm.validateFields()
        setSubmitting(true)

        const resp = await groupAddPassword(
            addPasswordDetail.id,
            values.password
        ).finally(() => setSubmitting(false))

        Notify.show({ type: 'success', message: '分组密码添加成功' })
        setGroupList(resp)
        onAddPasswordClose()
    }

    const onAddPasswordClose = () => {
        setAddPasswordDetail(undefined)
        addPasswordForm.setFieldsValue({ password: '', passwordConfirm: '' })
    }

    /**
     * 回调 - 移除密码
     */
    const onRemovePassword = async () => {
        if (!removePasswordDetail) {
            Notify.show({ type: 'warning', message: '移除失败，请刷新页面后再试' })
            return
        }

        const values = await removePasswordForm.validateFields()
        setSubmitting(true)

        const { salt, challenge } = await requireOperate(removePasswordDetail.id)

        const resp = await groupRemovePassword(
            removePasswordDetail.id,
            sha(sha(salt + values.password) + challenge),
            values.code
        ).finally(() => setSubmitting(false))

        Notify.show({ type: 'success', message: '分组密码移除成功' })
        setGroupList(resp)
        onRemovePasswordClose()
    }

    const onRemovePasswordClose = () => {
        setRemovePasswordDetail(undefined)
        removePasswordForm.setFieldsValue({ password: '', code: '' })
    }

    /**
     * 回调 - 保存分组排序
     */
    const onSave = async () => {
        const orders = groupList.map((group) => group.id)
        await updateGroupSort(orders)

        Notify.show({ type: 'success', message: '保存成功' })
        refetchGroupList()
        navigate(-1)
    }

    /**
     * 回调 - 设置默认分组
     */
    const onSetToDefault = async (item: CertificateGroupDetail) => {
        await setDefaultGroup(item.id)

        setUserProfile(old => {
            if (!old) return old
            return { ...old, defaultGroupId: item.id }
        })
        Notify.show({ type: 'success', message: `${item.name}已设置为默认分组` })
    }

    const validatePassword = async (_: any, value: string) => {
        const pwd = addPasswordForm.getFieldValue('password')
        if (!pwd || value === pwd) return
        throw new Error('两次输入密码不一致!')
    }

    const renderGroupItem = (item: CertificateGroupDetail) => {
        return (
            <div key={item.id} className='
                rounded-lg bg-slate-100 dark:bg-slate-600 select-none cursor-default py-2 px-4 my-4 
                flex justify-between items-center
            '>
                <span className='text-ellipsis bg-inherit whitespace-nowrap overflow-hidden'>{item.name}</span>
                <div className='shrink-0'>
                    {
                        item.id !== userProfile?.defaultGroupId &&
                        <span 
                            onClick={() => onSetToDefault(item)}
                            className='py-1 px-2 cursor-pointer text-orange-500 hover:bg-orange-500 hover:text-white transition rounded-lg'
                        >设为默认</span>
                    }
                    {
                        item.requireLogin
                            ? <span
                                onClick={() => setRemovePasswordDetail(item)}
                                className='py-1 px-2 cursor-pointer text-red-500 hover:bg-red-500 hover:text-white transition rounded-lg'
                            >移除密码</span>
                            : <span 
                                onClick={() => setAddPasswordDetail(item)}
                                className='py-1 px-2 cursor-pointer text-green-500 hover:bg-green-500 hover:text-white transition rounded-lg'
                            >添加密码</span>
                    }
                </div>
            </div>
        )
    }

    return (
        <div>
            <PageContent>
                <Header className='font-bold md:font-normal'>
                    分组管理
                </Header>

                <div className='px-4 lg:px-auto lg:mx-auto w-full lg:w-3/4 xl:w-1/2 mt-4'>
                    <div className='rounded-lg py-2 px-4 bg-white dark:bg-slate-700 dark:text-slate-200'>
                        <ReactSortable animation={100} list={groupList} setList={setGroupList}>
                            {groupList.map(renderGroupItem)}
                        </ReactSortable>
                    </div>

                    <div className='hidden md:block mt-6'>
                        <Button block onClick={onSave} color={config?.buttonColor}>
                            保存并返回
                        </Button>
                    </div>

                    <div className='w-full text-center text-gray-500 dark:text-gray-400 mt-6 cursor-default text-sm'>
                        拖动分组可进行排序<br />
                        分组重命名及分组删除请在分组详情页内进行
                    </div>
                </div>
            </PageContent>

            <Popup
                round
                className='w-[90%] md:w-1/2 lg:w-1/3'
                visible={!!addPasswordDetail}
                onClose={onAddPasswordClose}
            >
                <div className='p-6'>
                    <div className='flex items-center flex-col'>
                        <Form form={addPasswordForm} className='rounded-lg w-full mb-4 bg-white dark:bg-slate-700 dark:text-slate-200'>
                            <Form.Item
                                name="password"
                                label="分组密码"
                                customField
                                rules={[{ required: true, message: '请填写分组密码' }]}
                            >
                                <Field type='password' />
                            </Form.Item>
                            <Form.Item
                                name="passwordConfirm"
                                validateTrigger="onChange"
                                customField
                                label="重复密码"
                                rules={[{ required: true, validator: validatePassword }]}
                            >
                                <Field type='password' />
                            </Form.Item>
                        </Form>
                        <Button
                            block
                            className='shrink-0 !ml-2'
                            onClick={onSetPassword}
                            color={config?.buttonColor}
                            loading={submitting}
                        >
                            确 定
                        </Button>
                    </div>
                </div>
            </Popup>

            <Popup
                round
                className='w-[90%] md:w-1/2 lg:w-1/3'
                visible={!!removePasswordDetail}
                onClose={onRemovePasswordClose}
            >
                <div className='p-6'>
                    <div className='flex items-center flex-col'>
                        <Form form={removePasswordForm} className='rounded-lg w-full mb-4 bg-white dark:bg-slate-700 dark:text-slate-200'>
                            <Form.Item
                                name="password"
                                label="分组密码"
                                customField
                                rules={[{ required: true, message: '请填写分组密码' }]}
                                labelClass='w-28'
                            >
                                <Field type='password' />
                            </Form.Item>
                            {
                                otpInfo?.registered &&
                                <Form.Item
                                    name="code"
                                    customField
                                    label="动态验证码"
                                    rules={[{ required: true, message: '请填写动态验证码' }]}
                                    labelClass='w-28'
                                >
                                    <Field />
                                </Form.Item>
                            }
                            
                        </Form>
                        <Button
                            block
                            className='shrink-0 !ml-2'
                            onClick={onRemovePassword}
                            color={config?.buttonColor}
                            loading={submitting}
                        >
                            确 定
                        </Button>
                    </div>
                </div>
            </Popup>

            <PageAction>
                <ActionButton onClick={onSave}>保存并返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default GroupManage