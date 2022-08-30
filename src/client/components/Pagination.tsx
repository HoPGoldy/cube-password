import React, { FC } from 'react'
import { Button } from './Button'

interface Props {
    className?: string
    total?: number
    pageSize: number
    pageIndex: number
    onChange?: (pageIndex: number, pageSize: number) => unknown
}

/**
 * 自适应尺寸的分页
 */
const Pagination: FC<Props> = (props) => {
    const { className, total, pageSize, pageIndex, onChange } = props
    const maxPage = Math.ceil((total || 0) / pageSize)

    const onPageChange = (changeCount: number) => {
        const newPageIndex = pageIndex + changeCount
        if (newPageIndex < 1 || newPageIndex > maxPage) return
        if (onChange) onChange(newPageIndex, pageSize)
    }

    return (
        <div className={'flex items-center justify-between cursor-default dark:text-gray-200 ' + className}>
            <span className='md:mr-2 order-3 md:order-1'>共计 {total} 条</span>
            <Button className='order-2' onClick={() => onPageChange(-1)}>上一页</Button>
            <span className='mx-2 order-4'>{pageIndex} / {maxPage}</span>
            <Button className='order-5' onClick={() => onPageChange(1)}>下一页</Button>
        </div>
    )
}

export default Pagination