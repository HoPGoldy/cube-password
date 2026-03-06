import { ErrorBadRequest } from "@/types/error";

export class ErrorOtpVerifyFailed extends ErrorBadRequest {
  constructor() {
    super("验证码错误");
    this.code = 40030;
  }
}

export class ErrorOtpAlreadyBound extends ErrorBadRequest {
  constructor() {
    super("已绑定 TOTP，请先解绑");
    this.code = 40031;
  }
}

export class ErrorOtpNotBound extends ErrorBadRequest {
  constructor() {
    super("尚未绑定 TOTP");
    this.code = 40032;
  }
}
