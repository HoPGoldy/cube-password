import { HttpRequestLog } from '@/types/app'
import React, { FC } from 'react'
import { Dialog } from 'react-vant'

export const METHOD_BG_COLOR: Record<string, string> = {
    GET: 'bg-sky-600',
    POST: 'bg-green-600',
    PUT: 'bg-orange-600',
    DELETE: 'bg-red-600',
}

export const METHOD_TEXT_COLOR: Record<string, string> = {
    GET: 'text-sky-600',
    POST: 'text-green-600',
    PUT: 'text-orange-600',
    DELETE: 'text-red-600',
}

interface Props {
    details?: HttpRequestLog
    onClose: () => void
}

const codeAreaClass = 'bg-slate-200 dark:bg-slate-600 rounded p-2 my-2 overflow-auto block'

export const RequestLogDialog: FC<Props> = (props) => {
    const { details, onClose } = props

    return (
        <Dialog
            visible={!!details}
            showCancelButton
            showConfirmButton={false}
            cancelButtonText="关闭"
            onCancel={onClose}
            onClose={onClose}
        >
            <div className='p-4 dark:text-gray-300'>
                <header className='flex flex-row flex-nowrap justify-between items-center mb-4 pb-4 border-b'>
                    <div>
                        <div className='text-lg font-bold'>{details?.name}</div>
                        <div className='text-sm'>
                            <span className='mr-4'>HTTP {details?.responseHttpStatus}</span>
                            <span>响应状态码 {details?.responseStatus}</span>
                        </div>
                    </div>
                    <div className={
                        'text-white dark:text-gray-300 py-1 px-2 rounded ' + 
                        METHOD_BG_COLOR[details?.method || '']
                    }>
                        {details?.method}
                    </div>
                </header>
                
                <div className='mb-1'>
                    <span>请求接口：</span>
                    <code className={codeAreaClass}>{details?.url}</code>
                </div>
                <div className='mb-1'>
                    <span>请求 ip：</span>
                    <code className={codeAreaClass}>{details?.ipType} {details?.ip}</code>
                </div>
                <div className='mb-1'>
                    <span>ip 所在地：</span>
                    <code className={codeAreaClass}>{details?.location}</code>
                </div>
                <div className='mb-1'>
                    <span>请求时间：</span>
                    <code className={codeAreaClass}>{details?.date}</code>
                </div>
                <div className='mb-1'>
                    <div>请求 params：</div>
                    <code className={codeAreaClass}>{details?.requestParams}</code>
                </div>
                <div className='mb-1'>
                    <div>请求 body：</div>
                    <code className={codeAreaClass}>{details?.requestBody}</code>
                </div>
            </div>
        </Dialog>
    )
}
