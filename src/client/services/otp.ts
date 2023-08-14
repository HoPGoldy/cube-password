import { useMutation, useQuery } from 'react-query';
import { requestPost } from './base';

/** 获取 otp 绑定二维码 */
export const useGetOtpQrCode = () => {
  return useQuery('otpQrcode', () => {
    return requestPost('otp/getQrcode');
  });
};

/** 绑定动态验证码 */
export const useBindOtp = () => {
  return useMutation((code: string) => {
    return requestPost('otp/registerOTP', { code });
  });
};

/** 解绑动态验证码 */
export const useUnbindOtp = () => {
  return useMutation((code: string) => {
    return requestPost('otp/removeOTP', { code });
  });
};
