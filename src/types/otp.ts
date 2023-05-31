/**
 * opt 绑定情况
 */
export interface RegisterOTPInfo {
    /**
     * 是否已经注册
     */
    registered: boolean
    /**
     * 二维码 base64 编码
     * 未注册时才会显示
     */
    qrCode?: string
}

export interface RemoveOtpReqData {
    /** 密码 */
    a: string
    /** 验证码 */
    b: string
}