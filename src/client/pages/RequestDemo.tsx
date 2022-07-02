import React, { useState, useEffect } from 'react'
import { demoDelete, demoGet, demoPost, demoPut } from '@/client/services/demo'
import { TodoTask } from '@/types/demo'

const RequestDemo = () => {
    const [newTask, setNewTask] = useState('')
    const [taskList, setTaskList] = useState<TodoTask[]>([])

    const fetchTaskList = async () => {
        const { data } = await demoGet()
        data && setTaskList(data)
    }

    useEffect(() => {
        fetchTaskList()
    }, [])

    const submitNewTask = async (taskContent: string) => {
        if (!taskContent) return
        const { data } = await demoPost(taskContent)
        setNewTask('')
        data && setTaskList(data)
    }

    const onClickEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return
        submitNewTask((e.target as HTMLInputElement).value)
    }

    const onClickDone = async (detail: TodoTask) => {
        const { data } = await demoPut(detail.id, !detail.done)
        data && setTaskList(data)
    }

    const onClickDelete = async (detail: TodoTask) => {
        const { data } = await demoDelete(detail.id)
        data && setTaskList(data)
    }

    const renderTask = (taskDetail: TodoTask) => {
        return (
            <div key={taskDetail.id} className="py-2 px-4 bg-gray-200 rounded-lg mb-4">
                <span className="font-bold mr-2">[{taskDetail.id}]</span>
                <span className="mr-2 cursor-pointer text-blue-500" onClick={() => onClickDone(taskDetail)}>
                    {taskDetail.done ? '取消' : '完成'}
                </span>
                <span className="mr-2 cursor-pointer text-red-500" onClick={() => onClickDelete(taskDetail)}>删除</span>
                {/* 完成了就添加删除线 */}
                <span className={taskDetail.done ? 'line-through' : ''}>{taskDetail.content}</span>
            </div>
        )
    }

    return (
        <div className="m-auto w-96 text-left">
            <input
                value={newTask}
                onInput={e => setNewTask((e.target as HTMLInputElement).value)}
                onKeyUp={onClickEnter}
                placeholder="添加新待办，按回车确认"
                className="py-2 px-4 bg-gray-200 rounded-lg w-full"
            />
            <div className="mt-4">
                {taskList.map(renderTask)}
            </div>
        </div>
    )
}

export default RequestDemo