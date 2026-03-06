import { AppInstance } from "@/types";
import {
  SchemaOtpGetQrcodeResponse,
  SchemaOtpBindBody,
  SchemaOtpRemoveBody,
} from "@/types/otp";
import { OtpService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  otpService: OtpService;
}

export const registerOtpController = (options: RegisterOptions) => {
  const { server, otpService } = options;

  server.post(
    "/otp/get-qrcode",
    {
      schema: {
        description: "获取 TOTP 二维码",
        tags: ["otp"],
        response: { 200: SchemaOtpGetQrcodeResponse },
      },
    },
    async () => {
      return await otpService.getQrcode();
    },
  );

  server.post(
    "/otp/bind",
    {
      schema: {
        description: "绑定 TOTP",
        tags: ["otp"],
        body: SchemaOtpBindBody,
      },
    },
    async (request) => {
      await otpService.bind(request.body.code);
      return {};
    },
  );

  server.post(
    "/otp/remove",
    {
      schema: {
        description: "解绑 TOTP",
        tags: ["otp"],
        body: SchemaOtpRemoveBody,
      },
    },
    async (request) => {
      const { hash, challengeCode, code } = request.body;
      await otpService.remove(hash, challengeCode, code);
      return {};
    },
  );
};
