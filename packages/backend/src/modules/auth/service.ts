import { PrismaService } from "@/modules/prisma";
import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { LoginLocker } from "@/lib/login-locker";
import { NotificationService } from "@/modules/notification/service";
import { NoticeType } from "@/types/notification";
import { sha512 } from "@/lib/crypto";
import { queryIp, isSameLocation, formatLocation } from "@/lib/ip-location";
import { verifySync } from "otplib";
import { ErrorAuthFailed, ErrorBanned, ErrorNeedLogin } from "./error";
import {
  ErrorBadRequest,
  ErrorForbidden,
  ErrorUnauthorized,
} from "@/types/error";

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

  async isInitialized(): Promise<boolean> {
    const user = await this.prisma.user.findFirst();
    return !!user;
  }

  async init(passwordHash: string): Promise<void> {
    const existing = await this.prisma.user.findFirst();
    if (existing) {
      throw new ErrorBadRequest("用户已存在，不可重复初始化");
    }

    // 创建用户
    const user = await this.prisma.user.create({
      data: { passwordHash },
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

  async login(hash: string, challengeCode: string, ip: string, code?: string) {
    // 验证 challenge
    if (!this.challengeManager.validateChallenge(challengeCode)) {
      await this.notificationService.createNotice(
        "非法登录",
        "未授权状态下进行登录操作，已被拦截。",
        NoticeType.Danger,
      );
      throw new ErrorUnauthorized("挑战码无效或已过期");
    }

    // 检查 IP 锁定
    if (this.loginLocker.isLocked(ip)) {
      throw new ErrorForbidden("登录失败次数过多，请一天后再试");
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
          throw new ErrorUnauthorized("非常用地区登录，请输入动态验证码");
        }
        const isValid = verifySync({
          token: code,
          secret: user.totpSecret,
        }).valid;
        if (!isValid) {
          this.loginLocker.recordLoginFail(ip);
          throw new ErrorBadRequest("动态验证码错误");
        }
      }
    }

    // 验证密码: hash = SHA512(passwordHash + challengeCode)
    const expectedHash = sha512(user.passwordHash + challengeCode);
    if (hash !== expectedHash) {
      this.loginLocker.recordLoginFail(ip);
      const location = queryIp(ip);
      await this.notificationService.createNotice(
        "密码错误",
        `${ip}（${formatLocation(location)}）在登录时输入了错误的密码，请检查是否为本人操作。`,
        NoticeType.Warning,
      );
      throw new ErrorAuthFailed();
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
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        lockType: g.lockType,
      })),
    };
  }

  logout(): void {
    this.sessionManager.destroySession();
  }

  async changePassword(
    oldHash: string,
    challengeCode: string,
    newPasswordHash: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) throw new ErrorNeedLogin();

    // 验证旧密码
    const expectedOldHash = sha512(user.passwordHash + challengeCode);
    if (oldHash !== expectedOldHash) {
      throw new ErrorAuthFailed();
    }

    // 更新密码
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
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
