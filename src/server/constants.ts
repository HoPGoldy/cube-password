import { STATUS_CODE } from '@/config'
import path from 'path'

/**
 * 默认配置 json 路径
 */
export const DEFAULT_CONFIG_PATH = path.join(__dirname, '../../config.example.json')

/**
 * 分组未解密时的响应
 */
export const groupLockResp = { code: STATUS_CODE.GROUP_NOT_VERIFY_PASSWORD, msg: '分组未解密' }