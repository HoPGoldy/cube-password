import React, { FC } from 'react'
import { Loading } from 'react-vant'

export interface TableColConfig {
    dataIndex: string
    title: string
    width?: string
    render?: (text: any, record: any) => React.ReactNode
}

interface Props {
    loading?: boolean
    dataSource: Record<string, any>[]
    columns: TableColConfig[]
}

/**
 * 自适应尺寸的表格
 */
const Table: FC<Props> = (props) => {
    const { dataSource = [], columns, loading = false } = props

    const renderLogItem = (item: any) => {
        return (
            <div className='flex flex-nowrap bg-slate-50 rounded-lg mb-2 hover:bg-white transition'>
                {columns.map(col => {
                    if (col.render) return col.render((item as any)[col.dataIndex], item)
                    return (
                        <div
                            className='px-4 py-2 shrink-0'
                            key={col.dataIndex}
                            style={{ width: col.width, flexGrow: col.width ? 0 : 1 }}
                        >
                            {(item as any)[col.dataIndex]}
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderTableHeader = (col: TableColConfig) => {
        return (
            <div className="px-4 py-2 bg-slate-100 mb-2 shrink-0" style={{ width: col.width, flexGrow: col.width ? 0 : 1 }}>
                {col.title}
            </div>
        )
    }

    return (
        <div className='m-4 cursor-default'>
            <div className='flex flex-nowrap rounded-lg'>
                {columns.map(renderTableHeader)}
            </div>
            <div className='relative'>
                {dataSource.length <= 0 ? (
                    <div className='px-4 py-2 rounded h-[160px] leading-[140px] text-center bg-slate-50 text-slate-600'>
                        暂无数据
                    </div>
                ) : dataSource.map(renderLogItem)}
                {loading && (
                    <div className='absolute inset-0 bg-white opacity-70 flex items-center justify-center'>
                        <div>
                            <Loading color="#3f45ff" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Table