import { sendGet, sendPost, sendPut, sendDelete } from './base'
import { TodoTask } from '@/types/demo'

/** 获取代办列表 */
export const demoGet = async () => {
    return sendGet<TodoTask[]>('/demo')
}

/** 新增代办 */
export const demoPost = async (task: string) => {
    return sendPost<TodoTask[]>('/demo', { task })
}

/** 完成 / 未完成代办 */
export const demoPut = async function (taskId: number, done: boolean) {
    return sendPut<TodoTask[]>(`/demo/${taskId}`, { done })
}

/** 删除代办 */
export const demoDelete = async function (taskId: number) {
    return sendDelete<TodoTask[]>(`/demo/${taskId}`)
}
