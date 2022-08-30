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
    renderMobile: (data: any) => React.ReactNode
    dataSource: Record<string, any>[]
    columns: TableColConfig[]
}

/**
 * 自适应尺寸的表格
 */
const Table: FC<Props> = (props) => {
    const { dataSource = [], columns, loading = false, renderMobile } = props

    const renderLogItem = (item: any) => {
        return (
            <div
                className='
                    flex flex-nowrap bg-slate-50 dark:bg-slate-700 rounded-lg mb-2 
                    hover:bg-white dark:hover:bg-slate-600 transition
                '
                key={item.id}
            >
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
            <div
                key={col.dataIndex}
                className="px-4 py-2 shrink-0"
                style={{ width: col.width, flexGrow: col.width ? 0 : 1 }}
            >
                {col.title}
            </div>
        )
    }

    return (
        <div className='m-4 mb-0 md:my-4 cursor-default dark:text-gray-200'>
            <div className='hidden lg:flex flex-nowrap rounded-lg bg-slate-100 dark:bg-slate-600 mb-2'>
                {columns.map(renderTableHeader)}
            </div>
            <div className='hidden lg:block relative'>
                {dataSource.length <= 0 ? (
                    <div className='
                        px-4 py-2 rounded-lg h-[160px] leading-[140px] text-center bg-slate-50 text-slate-600 
                        dark:bg-slate-700 dark:text-gray-200
                    '>
                        暂无数据
                    </div>
                ) : dataSource.map(renderLogItem)}
                {loading && (
                    <div className='absolute inset-0 bg-white dark:bg-slate-700 opacity-70 flex items-center justify-center'>
                        <div>
                            <Loading color="#3f45ff" className="dark:!text-gray-200" />
                        </div>
                    </div>
                )}
            </div>
            <div className='block lg:hidden'>
                {dataSource.map(renderMobile)}
            </div>
        </div>
    )
}

export default Table