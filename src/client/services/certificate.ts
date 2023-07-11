import { requestGet } from './base'

/**
 * 获取随机英文名
 */
export const getRandName = async () => {
    return await requestGet<string>('certificate/randName')
}