import { PrismaService } from "@/modules/prisma";
import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { LoginLocker } from "@/lib/login-locker";
import { NotificationService } from "@/modules/notification/service";
import { NoticeType } from "@/types/notification";
import { sha512, getAesMeta, aesEncrypt, aesDecrypt } from "@/lib/crypto";
import { queryIp, isSameLocation, formatLocation } from "@/lib/ip-location";
import { verifySync, generateSync } from "otplib";
import {
  ErrorAuthFailed,
  ErrorBanned,
  ErrorNeedLogin,
  ErrorNeedTotpCode,
} from "./error";
import {
  ErrorBadRequest,
  ErrorForbidden,
  ErrorUnauthorized,
} from "@/types/error";
import { nanoid } from "nanoid";

interface AuthServiceDeps {
  prisma: PrismaService;
  sessionManager: SessionManager;
  challengeManager: ChallengeManager;
  loginLocker: LoginLocker;
  notificationService: NotificationService;
}

export class AuthService {
  private prisma: PrismaService;
  private sessionManager: SessionManager;
  private challengeManager: ChallengeManager;
  private loginLocker: LoginLocker;
  private notificationService: NotificationService;

  constructor(deps: AuthServiceDeps) {
    this.prisma = deps.prisma;
    this.sessionManager = deps.sessionManager;
    this.challengeManager = deps.challengeManager;
    this.loginLocker = deps.loginLocker;
    this.notificationService = deps.notificationService;
  }

  getChallenge(): string {
    return this.challengeManager.generateChallenge();
  }

  async isInitialized() {
    const user = await this.prisma.user.findFirst();
    const lockDetail = this.loginLocker.getLockDetail();
    return {
      isInitialized: !!user,
      salt: user?.passwordSalt || undefined,
      ...lockDetail,
    };
  }

  async init(passwordHash: string, passwordSalt: string): Promise<void> {
    const existing = await this.prisma.user.findFirst();
    if (existing) {
      throw new ErrorBadRequest("用户已存在，不可重复初始化");
    }

    // 创建用户
    const user = await this.prisma.user.create({
      data: { passwordHash, passwordSalt },
    });

    // 创建默认分组
    await this.prisma.group.create({
      data: { name: "默认分组", order: 0 },
    });

    // 设置 defaultGroupId
    const group = await this.prisma.group.findFirst();
    if (group) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { defaultGroupId: group.id },
      });
    }
  }

  async login(hash: string, ip: string, code?: string) {
    // 验证 challenge（服务端自行 pop，无需客户端回传）
    const challengeCode = this.challengeManager.popLastChallenge();
    if (!challengeCode) {
      await this.notificationService.createNotice(
        "非法登录",
        "未授权状态下进行登录操作，已被拦截。",
        NoticeType.Danger,
      );
      throw new ErrorUnauthorized("挑战码无效或已过期");
    }

    // 检查 IP 锁定
    if (this.loginLocker.isLocked(ip)) {
      const error = new ErrorForbidden("登录失败次数过多，请一天后再试");
      error.data = this.loginLocker.getLockDetail();
      throw error;
    }

    const user = await this.prisma.user.findFirst();
    if (!user) {
      throw new ErrorAuthFailed();
    }

    const currentLocation = queryIp(ip);

    // 异地登录检测
    if (
      user.commonLocation &&
      !isSameLocation(user.commonLocation, currentLocation)
    ) {
      if (!user.totpSecret) {
        // 没有绑定 TOTP，记录安全通知
        await this.notificationService.createNotice(
          "异地登录",
          `${ip}（${formatLocation(currentLocation)}）进行了一次异地登录，上次登录地为${formatLocation(user.commonLocation)}，请检查是否为本人操作。`,
          NoticeType.Warning,
        );
      } else {
        // 绑定了 TOTP，需要验证码
        if (!code) {
          throw new ErrorNeedTotpCode();
        }
        const isValid = verifySync({
          token: code,
          secret: user.totpSecret,
        }).valid;
        if (!isValid) {
          const lockDetail = this.loginLocker.recordLoginFail(
            ip,
            formatLocation(currentLocation),
          );
          const error = new ErrorBadRequest(
            lockDetail.isBanned
              ? "动态验证码错误，账号已被锁定"
              : `动态验证码错误，将在 ${lockDetail.retryNumber} 次后锁定登录`,
          );
          error.data = lockDetail;
          throw error;
        }
      }
    }

    // 验证密码: hash = SHA512(passwordHash + challengeCode)
    const expectedHash = sha512(user.passwordHash + challengeCode);
    if (hash !== expectedHash) {
      const lockDetail = this.loginLocker.recordLoginFail(
        ip,
        formatLocation(currentLocation),
      );
      await this.notificationService.createNotice(
        "密码错误",
        `${ip}（${formatLocation(currentLocation)}）在登录时输入了错误的密码，请检查是否为本人操作。`,
        NoticeType.Warning,
      );
      const error = new ErrorAuthFailed();
      error.message = lockDetail.isBanned
        ? "账号或密码错误，账号已被锁定"
        : `账号或密码错误，将在 ${lockDetail.retryNumber} 次后锁定登录`;
      error.data = lockDetail;
      throw error;
    }

    // 创建 session
    const session = this.sessionManager.createSession();

    // 自动解锁无锁分组
    const groups = await this.prisma.group.findMany({
      orderBy: { order: "asc" },
    });
    for (const group of groups) {
      if (group.lockType === "None") {
        this.sessionManager.addUnlockedGroup(group.id);
      }
    }

    // 更新常用登录地
    if (currentLocation) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { commonLocation: currentLocation },
      });
    }

    const hasNotice = await this.notificationService.hasUnread();

    return {
      token: session.token,
      replayAttackSecret: session.replayAttackSecret,
      theme: user.theme,
      initTime: user.initTime.toISOString(),
      defaultGroupId: user.defaultGroupId,
      hasNotice,
      withTotp: !!user.totpSecret,
      createPwdAlphabet: user.createPwdAlphabet,
      createPwdLength: user.createPwdLength,
      salt: user.passwordSalt,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        lockType: g.lockType,
        salt: g.passwordSalt || undefined,
      })),
    };
  }

  logout(): void {
    this.sessionManager.destroySession();
  }

  async changePassword(encryptedData: string): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) throw new ErrorNeedLogin();

    const session = this.sessionManager.getCurrentSession();
    if (!session) throw new ErrorNeedLogin();

    const challengeCode = this.challengeManager.popLastChallenge();
    if (!challengeCode) {
      throw new ErrorUnauthorized("挑战码无效或已过期");
    }

    const totpCode = user.totpSecret
      ? generateSync({ secret: user.totpSecret })
      : "";

    // 构造解密密钥: SHA512(salt + oldPassword) + challengeCode + sessionToken + totpCode
    // 注意：passwordHash 就是 SHA512(salt + oldPassword)
    const postKey =
      user.passwordHash + challengeCode + session.token + totpCode;
    const { key, iv } = getAesMeta(postKey);

    const decrypted = aesDecrypt(encryptedData, key, iv);
    if (!decrypted) {
      throw new ErrorBadRequest("无效的密码修改凭证");
    }

    const { oldPassword, newPassword } = JSON.parse(decrypted) as {
      oldPassword: string;
      newPassword: string;
    };

    // 重新加密所有凭证
    const oldMeta = getAesMeta(oldPassword);
    const newMeta = getAesMeta(newPassword);

    const allCertificates = await this.prisma.certificate.findMany({
      select: { id: true, content: true },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const cert of allCertificates) {
        try {
          const decryptedContent = aesDecrypt(
            cert.content,
            oldMeta.key,
            oldMeta.iv,
          );
          const reEncrypted = aesEncrypt(
            decryptedContent,
            newMeta.key,
            newMeta.iv,
          );
          await tx.certificate.update({
            where: { id: cert.id },
            data: { content: reEncrypted },
          });
        } catch {
          // 解密失败的凭证跳过（可能是分组加密的）
        }
      }

      // 更新密码
      const newSalt = nanoid(128);
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: sha512(newSalt + newPassword),
          passwordSalt: newSalt,
        },
      });
    });

    // 销毁 session
    this.sessionManager.destroySession();
  }

  validateSession(token: string) {
    const session = this.sessionManager.getSession(token);
    if (!session) throw new ErrorNeedLogin();
    return session;
  }
}
