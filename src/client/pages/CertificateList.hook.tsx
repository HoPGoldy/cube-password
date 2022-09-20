import React, { useContext, useState, ReactElement, useEffect } from 'react'
import { Dialog, Notify } from 'react-vant'
import { Clear, Delete, Sort, Checked } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { useMoveCertificate, useDeleteCertificate } from '../services/certificate'
import { deleteGroup } from '../services/certificateGroup'
import { CertificateGroupDetail } from '@/types/http'
import { DialogProps } from 'react-vant/es/dialog/PropsType'
import { useMutation } from 'react-query'

interface ConfigButtonProps {
    onClick: () => void
    icon: ReactElement
    label: string
}

export const useEditor = () => {
    const { groupList, certificateList, selectedGroup, setUserProfile, setSelectedGroup, refetchGroupList } = useContext(UserContext)
    // 是否显示操作按钮组
    const [showConfigArea, setShowConfigArea] = useState(false)
    // 被选中的凭证
    const [selectedItem, setSelectedItem] = useState<Record<number, boolean>>({})
    // 是否显示选择新分组弹窗
    const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
    // 要移动到的目标分组
    const [targetMoveGroupId, setTargetMoveGroupId] = useState<number | undefined>(undefined)
    // 移除凭证
    const { mutate: deleteCertificate } = useDeleteCertificate(selectedGroup)
    // 移动凭证
    const { mutate: moveCertificate } = useMoveCertificate(selectedGroup)
    // 移除分组
    const { mutate: runDeleteGroup } = useMutation(deleteGroup, {
        onSuccess: defaultGroupId => {
            Notify.show({ type: 'success', message: '删除成功' })

            setUserProfile?.(old => {
                if (!old) return old
                return { ...old, defaultGroupId }
            })
            setSelectedGroup(defaultGroupId)
            refetchGroupList()
        }
    })

    // 选择了其他的分组，隐藏操作按钮
    useEffect(() => {
        setShowConfigArea(false)
        setSelectedItem({})
    }, [selectedGroup])

    // 切换是否显示编辑模式
    const onSwitchConfigArea = () => {
        setShowConfigArea(!showConfigArea)
        setSelectedItem({})
    }

    // 点击了某个要移动到的分组
    const onConfirmMove = async (newGroupId: number) => {
        const ids = Object.keys(selectedItem).filter(key => selectedItem[+key]).map(Number)
        if (ids.length === 0) {
            Notify.show({ type: 'warning', message: '请选择至少一个凭证' })
            return
        }

        await moveCertificate({ ids, newGroupId })
    }

    const renderMoveGroupItem = (item: CertificateGroupDetail) => {
        return (
            <div
                key={item.id}
                className={
                    'rounded-lg  ring-slate-300 py-2 mt-2 transition border border-slate-300 cursor-pointer ' +
                    'hover:ring hover:ring-slate-500 active:scale-90 dark:text-slate-200 ' +
                    (targetMoveGroupId === item.id
                        // 选中样式
                        ? 'bg-slate-500 text-white hover:bg-slate-500 dark:hover:bg-slate-800'
                        // 未选中样式
                        : 'hover:bg-slate-300 dark:hover:bg-slate-500 hover:text-black '
                    )
                }
                onClick={() => setTargetMoveGroupId(item.id)}
            >{item.name}</div>
        )
    }

    const getNewGroupSelectProps = (): DialogProps => {
        return {
            visible: showNewGroupDialog,
            title: <div className='dark:text-slate-200'>请选择要移动到的分组</div>,
            confirmButtonText: '移动',
            showCancelButton: true,
            closeOnClickOverlay: true,
            onCancel: () => setShowNewGroupDialog(false),
            onClose: () => setShowNewGroupDialog(false),
            onConfirm: async () => {
                if (!targetMoveGroupId) {
                    Notify.show({ type: 'warning', message: '请选择要转移到的分组' })
                    return
                }
                await onConfirmMove(targetMoveGroupId)
                setTargetMoveGroupId(undefined)
                setShowNewGroupDialog(false)
            },

            children: (
                <div className='text-center p-4'>
                    {groupList.length <= 1
                        ? <div className='text-gray-500'>没有可以转移到的分组</div>
                        : groupList.filter(item => item.id !== selectedGroup).map(renderMoveGroupItem)}
                </div>
            )
        }
    }

    const onDeleteGroup = async () => {
        Dialog.confirm({
            message: <div className='dark:text-slate-200'>确定要删除本分组？删除后将无法恢复</div>,
            confirmButtonText: '删除',
            confirmButtonColor: '#ef4444',
            onConfirm: async () => {
                await runDeleteGroup(selectedGroup)
                setShowConfigArea(false)
            }
        })
    }

    const onDeleteCertificate = async () => {
        const ids = Object.keys(selectedItem).filter(key => selectedItem[+key]).map(Number)
        if (ids.length === 0) {
            Notify.show({ type: 'warning', message: '请选择至少一个凭证' })
            return
        }

        await Dialog.confirm({
            message: <div className='dark:text-slate-200'>确定要删除这 {ids.length} 个凭证？删除后将无法恢复</div>,
            confirmButtonText: '删除',
            confirmButtonColor: '#ef4444',
            closeOnClickOverlay: true,
            onConfirm: async () => {
                await deleteCertificate(ids)
                setShowConfigArea(false)
            }
        })
    }

    const onMoveCertificate = async () => {
        if (groupList.length <= 1) {
            Notify.show({ type: 'warning', message: '没有可以转移的分组' })
            return
        }

        if (Object.keys(selectedItem).length === 0) {
            Notify.show({ type: 'warning', message: '请选择至少一个凭证' })
            return
        }

        setShowNewGroupDialog(true)
    }

    // 全选 / 非全选切换
    const onSwitchAllItem = () => {
        if (!certificateList) return
        const newSelectedItem: Record<number, boolean> = {}
        certificateList.forEach(item => {
            newSelectedItem[item.id] = !selectedItem[item.id]
        })
        setSelectedItem(newSelectedItem)
    }

    const configButtons: ConfigButtonProps[] = [{
        onClick: onDeleteGroup,
        icon: <Delete className='mb-1 text-red-500' fontSize={24} />,
        label: '删除分组'
    }, {
        onClick: onDeleteCertificate,
        icon: <Clear className='mb-1 text-red-500' fontSize={22} />,
        label: '删除所选'
    }, {
        onClick: onMoveCertificate,
        icon: <Sort className='mb-1 text-sky-500' fontSize={24} />,
        label: '转移分组'
    }, {
        onClick: onSwitchAllItem,
        icon: <Checked className='mb-1 text-green-500' fontSize={24} />,
        label: '全选切换'
    }]

    return {
        showConfigArea, showNewGroupDialog, configButtons, selectedItem, setSelectedItem,
        onSwitchConfigArea, onConfirmMove, getNewGroupSelectProps
    }
}
