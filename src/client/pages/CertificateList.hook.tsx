import React, { useContext, useState, ReactElement } from 'react'
import { Dialog, Notify } from 'react-vant'
import { Clear, Delete, Sort, Checked } from '@react-vant/icons'
import { UserContext } from '../components/UserProvider'
import { useMoveCertificate, useDeleteCertificate } from '../services/certificate'
import { useDeleteGroup } from '../services/certificateGroup'

interface ConfigButtonProps {
    onClick: () => void
    icon: ReactElement
    label: string
}

export const useEditor = () => {
    const { certificateList, selectedGroup } = useContext(UserContext)
    // 是否显示操作按钮组
    const [showConfigArea, setShowConfigArea] = useState(true)
    // 被选中的凭证
    const [selectedItem, setSelectedItem] = useState<Record<number, boolean>>({})
    // 是否显示选择新分组弹窗
    const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
    // 移除分组
    const { mutate: deleteGroup } = useDeleteGroup((data: any) => {
        console.log(data)
    })
    // 移除凭证
    const { mutate: deleteCertificate } = useDeleteCertificate(selectedGroup)
    // 移动凭证
    const { mutate: moveCertificate } = useMoveCertificate(selectedGroup)

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

        moveCertificate({ ids, newGroupId })
        setShowNewGroupDialog(false)
    }

    const onDeleteGroup = async () => {
        Dialog.confirm({
            message: '确定要删除本分组？删除后将无法恢复',
            confirmButtonText: '删除',
            confirmButtonColor: '#ef4444',
            onConfirm: async () => {
                await deleteGroup(selectedGroup)
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
            message: `确定要删除这 ${ids.length} 个凭证？删除后将无法恢复`,
            confirmButtonText: '删除',
            confirmButtonColor: '#ef4444'
        })

        deleteCertificate(ids)
    }

    const onMoveCertificate = async () => {
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
        onSwitchConfigArea, onConfirmMove
    }
}
