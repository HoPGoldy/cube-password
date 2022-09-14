import { CertificateGroup } from '@/types/app'
import { sha } from '@/utils/crypto'
import { nanoid } from 'nanoid'
import React, { useContext } from 'react'
import { ReactSortable } from "react-sortablejs"
import { Form, Notify } from 'react-vant'
import { Button } from '@/client/components/Button'
import { UserContext } from '../components/UserProvider'
import { ActionButton, PageAction, PageContent } from '../components/PageWithAction'
import { setDefaultGroup, updateGroupSort } from '../services/certificateGroup'
import { AppConfigContext } from '../components/AppConfigProvider'
import { useNavigate } from '../Route'
import Header from '../components/Header'
import { CertificateGroupDetail } from '@/types/http'

const GroupManage = () => {
    const { setGroupList, groupList, refetchGroupList, userProfile, setUserProfile } = useContext(UserContext)
    const config = useContext(AppConfigContext)
    const navigate = useNavigate()

    /**
     * 保存分组排序
     */
    const onSave = async () => {
        const orders = groupList.map((group) => group.id)
        await updateGroupSort(orders)

        Notify.show({ type: 'success', message: '保存成功' })
        refetchGroupList()
        navigate(-1)
    }

    const onSetToDefault = async (item: CertificateGroupDetail) => {
        await setDefaultGroup(item.id)

        setUserProfile(old => {
            if (!old) return old
            return { ...old, defaultGroupId: item.id }
        })
        Notify.show({ type: 'success', message: `${item.name}已设置为默认分组` })
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
                            // onClick={() => onSetToDefault(item)}
                            className='py-1 px-2 cursor-pointer text-red-500 hover:bg-red-500 hover:text-white transition rounded-lg'
                        >移除密码</span>
                        : <span 
                            // onClick={() => onSetToDefault(item)}
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

            <PageAction>
                <ActionButton onClick={onSave}>保存并返回</ActionButton>
            </PageAction>
        </div>
    )
}

export default GroupManage