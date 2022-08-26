export interface ChangePwdCertificate {
  id: number
  content: string
}

/**
 * 序列化凭证数据
 */
export const serializeCertificate = (data: ChangePwdCertificate[]) => {
    return data.map(item => `${item.id}|${item.content}`).join(',')
}

/**
 * 反序列化凭证数据
 */
export const deserializeCertificate = (data: string) => {
    return data.split(',').map(item => {
        const [id, content] = item.split('|')
        return { id: +id, content }
    })
}