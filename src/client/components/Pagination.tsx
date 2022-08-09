import React, { ChangeEventHandler, FC, useEffect, useRef, useState } from 'react'
import { Button } from './Button'

interface Props {
    className?: string
    total?: number
    pageSize: number
    pageIndex: number
    onChange?: (pageIndex: number, pageSize: number) => unknown
}

/**
 * 支持自适应高度的 textarea
 */
const Pagination: FC<Props> = (props) => {
    const { className, total, pageSize, pageIndex, onChange } = props
    const maxPage = Math.ceil((total || 0) / pageSize)
    console.log('maxPage', maxPage, total, pageSize)

    const onPageChange = (changeCount: number) => {
        const newPageIndex = pageIndex + changeCount
        if (newPageIndex < 1 || newPageIndex > maxPage) return
        if (onChange) onChange(newPageIndex, pageSize)
    }

    return (
        <div className={className}>
            <span>共计 {total} 条</span>
            <Button onClick={() => onPageChange(-1)}>上一页</Button>
            <Button onClick={() => onPageChange(1)}>下一页</Button>
        </div>
    )
}

export default Pagination