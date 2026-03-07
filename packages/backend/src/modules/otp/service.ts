import { PrismaService } from "@/modules/prisma";
import { ChallengeManager } from "@/lib/challenge";
import { sha512 } from "@/lib/crypto";
import { generateSecret, verifySync, TOTP } from "otplib";
import { toDataURL } from "qrcode";
import {
  ErrorOtpVerifyFailed,
  ErrorOtpAlreadyBound,
  ErrorOtpNotBound,
} from "./error";
import { ErrorBadRequest } from "@/types/error";

interface OtpServiceDeps {
  prisma: PrismaService;
  challengeManager: ChallengeManager;
}

export class OtpService {
  private prisma: PrismaService;
  private challengeManager: ChallengeManager;
  private pendingSecret: string | null = null;

  constructor(deps: OtpServiceDeps) {
    this.prisma = deps.prisma;
    this.challengeManager = deps.challengeManager;
  }

  async getQrcode() {
    const user = await this.prisma.user.findFirst();
    if (!user) throw new ErrorBadRequest("用户不存在");

    if (user.totpSecret) {
      return { registered: true };
    }

    // 生成新的 secret
    const secret = generateSecret();
    this.pendingSecret = secret;

    const otpauth = new TOTP().toURI({
      label: "user",
      issuer: "CubePassword",
      secret,
    });
    const qrCode = await toDataURL(otpauth);

    return { registered: false, qrCode };
  }

  async bind(code: string): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) throw new ErrorBadRequest("用户不存在");

    if (user.totpSecret) throw new ErrorOtpAlreadyBound();
    if (!this.pendingSecret) throw new ErrorBadRequest("请先获取二维码");

    const isValid = verifySync({
      token: code,
      secret: this.pendingSecret,
    }).valid;
    if (!isValid) throw new ErrorOtpVerifyFailed();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: this.pendingSecret },
    });

    this.pendingSecret = null;
  }

  async remove(
    hash: string,
    challengeCode: string,
    code: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) throw new ErrorBadRequest("用户不存在");
    if (!user.totpSecret) throw new ErrorOtpNotBound();

    // 验证 challenge
    if (!this.challengeManager.validateChallenge(challengeCode)) {
      throw new ErrorBadRequest("挑战码无效或已过期");
    }

    // 验证密码
    const expectedHash = sha512(user.passwordHash + challengeCode);
    if (hash !== expectedHash) {
      throw new ErrorBadRequest("密码错误");
    }

    // 验证 TOTP
    const isValid = verifySync({ token: code, secret: user.totpSecret }).valid;
    if (!isValid) throw new ErrorOtpVerifyFailed();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: "" },
    });
  }
}
