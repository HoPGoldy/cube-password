import { AppKoaContext } from '@/types/global'
import CryptoJS from 'crypto-js'
import { nanoid } from 'nanoid'

const { SHA256, SHA512, AES, MD5, enc, mode, pad } = CryptoJS

/**
 * 获取 sha512 hash
 */
export const sha = (str: string) => {
    return SHA512(str).toString().toUpperCase()
}

/**
 * 将密码转换为 aes 加密需要的 key 和初始向量
 */
export const getAesMeta = (password: string) => {
    const key = enc.Utf8.parse(MD5(password).toString())
    const iv = enc.Utf8.parse(SHA256(password).toString())

    return { key, iv }
}

/**
 * 验证 aes 加密信息
 * 用于判断 key 和 iv 是否是从这个密码生成的
 */
export const validateAesMeta = (password: string, key: CryptoJS.lib.WordArray, iv: CryptoJS.lib.WordArray) => {
    const newKey = enc.Utf8.parse(MD5(password).toString())
    const newIv = enc.Utf8.parse(SHA256(password).toString())

    if (enc.Utf8.stringify(newKey) !== enc.Utf8.stringify(key)) return false
    if (enc.Utf8.stringify(newIv) !== enc.Utf8.stringify(iv)) return false
    return true
}

/**
 * aes 加密
 */
export const aes = (str: string, key: CryptoJS.lib.WordArray, iv: CryptoJS.lib.WordArray) => {
    const srcs = enc.Utf8.parse(str)
    const encrypted = AES.encrypt(srcs, key, { iv, mode: mode.CBC, padding: pad.Pkcs7 })
    return encrypted.ciphertext.toString()
}

/**
 * aes 解密 
 */
export const aesDecrypt = (str: string, key: CryptoJS.lib.WordArray, iv: CryptoJS.lib.WordArray) => {
    const encryptedHexStr = enc.Hex.parse(str)
    const srcs = enc.Base64.stringify(encryptedHexStr)
    const decrypt = AES.decrypt(srcs, key, { iv, mode: mode.CBC, padding: pad.Pkcs7 })
    const decryptedStr = decrypt.toString(enc.Utf8)
    return decryptedStr.toString()
}

/**
 * 生成防重放攻击 header
 *
 * @param url 请求地址
 * @param body 请求 body
 * @param secretKey 签名私钥
 */
export const createReplayAttackHeader = (url: string, bodyData: string, secretKey: string) => {
    // console.log('bodyData', bodyData)
    const timestamp = Date.now()
    const nonce = nanoid(128)
    const sign = sha(`${url}${bodyData}${nonce}${timestamp}${secretKey}`)
    return {
        'X-kmp-temestamp': timestamp,
        'X-kmp-nonce': nonce,
        'X-kmp-signature': sign,
    }
}

interface ReplayAttackData {
    url: string
    body: Record<string, any>
    timestamp: number
    nonce: string
    signature: string
}

/**
 * 从请求中获取防重放攻击数据
 */
export const getReplayAttackData = (ctx: AppKoaContext): ReplayAttackData | undefined => {
    const data = {
        url: ctx.url,
        body: ctx.request.body,
        timestamp: Number(ctx.get('X-kmp-temestamp')),
        nonce: ctx.get('X-kmp-nonce'),
        signature: ctx.get('X-kmp-signature')
    }

    if (!data.timestamp || !data.nonce || !data.signature) return undefined
    return data
}

/**
 * 验证防重放攻击 header
 */
export const validateReplayAttackData= (data: ReplayAttackData, secretKey: string) => {
    const { timestamp, url, body, nonce, signature } = data
    // console.log('bodyData', JSON.stringify(body))

    const serverTimestamp = Date.now()
    // 服务器时间和客户端时间相差 1 分钟以上，认为是无效请求
    if (serverTimestamp - timestamp > 1000 * 60) return false

    const newSign = sha(`${url}${JSON.stringify(body)}${nonce}${timestamp}${secretKey}`)
    return newSign === signature
}