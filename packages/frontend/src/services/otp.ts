import { useMutation, useQuery } from "@tanstack/react-query";
import { requestPost } from "./base";
import type {
  SchemaOtpGetQrcodeResponseType,
  SchemaOtpRemoveBodyType,
} from "@shared-types/otp";

/** 获取 OTP 二维码 */
export const useOtpQrcode = () => {
  return useQuery({
    queryKey: ["otpQrcode"],
    queryFn: () =>
      requestPost<SchemaOtpGetQrcodeResponseType>("otp/get-qrcode"),
    refetchOnWindowFocus: false,
  });
};

/** 绑定 OTP */
export const useBindOtp = () => {
  return useMutation({
    mutationFn: (code: string) => {
      return requestPost("otp/bind", { code });
    },
  });
};

/** 解绑 OTP */
export const useUnbindOtp = () => {
  return useMutation({
    mutationFn: (data: SchemaOtpRemoveBodyType) => {
      return requestPost("otp/remove", data);
    },
  });
};
