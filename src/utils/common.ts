import CryptoJS from 'crypto-js'

const { SHA256, SHA512, AES, MD5, enc, mode, pad } = CryptoJS

export const sha = (str: string) => {
    return SHA512(str).toString().toUpperCase()
}

export const aes = (str: string, password: string) => {
    const key = enc.Utf8.parse(MD5(password).toString())
    const iv = enc.Utf8.parse(SHA256(password).toString())

    const srcs = enc.Utf8.parse(str)
    const encrypted = AES.encrypt(srcs, key, { iv: iv, mode: mode.CBC, padding: pad.Pkcs7 })
    return encrypted.ciphertext.toString()
}

export const aesDecrypt = (str: string, password: string) => {
    const key = enc.Utf8.parse(MD5(password).toString())
    const iv = enc.Utf8.parse(SHA256(password).toString())

    const encryptedHexStr = enc.Hex.parse(str)
    const srcs = enc.Base64.stringify(encryptedHexStr)
    const decrypt = AES.decrypt(srcs, key, { iv: iv, mode: mode.CBC, padding: pad.Pkcs7 })
    const decryptedStr = decrypt.toString(enc.Utf8)
    return decryptedStr.toString()
}

/**
 * 将 loki 存储对象中的相关元数据擦除，并设置 id
 */
export const replaceLokiInfo = <T>(item: Record<any, any>): T & { id: number } => {
    const newItem: any = {
        id: item.$loki,
        ...item
    }

    delete newItem.meta
    delete newItem.$loki
    return newItem as T & { id: number }
}