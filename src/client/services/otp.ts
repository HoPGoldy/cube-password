import { useMutation, useQuery } from 'react-query';
import { requestPost } from './base';
import { RegisterOTPInfo, RemoveOtpReqData } from '@/types/otp';

/** 获取 otp 绑定二维码 */
export const useFetchOtpQrCode = () => {
  return useQuery(
    'otpQrcode',
    () => {
      return requestPost<RegisterOTPInfo>('otp/getQrcode');
    },
    {
      refetchOnWindowFocus: false,
    },
  );
};

/** 绑定动态验证码 */
export const useBindOtp = () => {
  return useMutation((code: string) => {
    return requestPost('otp/bind', { code });
  });
};

/** 解绑动态验证码 */
export const useUnbindOtp = () => {
  return useMutation((data: RemoveOtpReqData) => {
    return requestPost('otp/remove', data);
  });
};
