import { PrismaService } from "@/modules/prisma";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { LoginLocker } from "@/lib/login-locker";
import { NotificationService } from "@/modules/notification/service";
import { NoticeType } from "@/types/notification";
import { sha512, timingSafeEqual } from "@/lib/crypto";
import { verifySync } from "otplib";
import { ErrorAuthFailed, ErrorNeedLogin } from "./error";
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

  async isInitialized() {
    const user = await this.prisma.user.findFirst();
    const lockDetail = this.loginLocker.getLockDetail();
    return {
      isInitialized: !!user,
      salt: user?.passwordSalt || undefined,
      kdfParams: user?.kdfParams || undefined,
      ...lockDetail,
    };
  }

  async init(data: {
    verifier: string;
    salt: string;
    keyBlob: string;
    kdfParams: string;
  }): Promise<void> {
    const existing = await this.prisma.user.findFirst();
    if (existing) {
      throw new ErrorBadRequest("用户已存在，不可重复初始化");
    }

    // 创建用户（passwordHash 语义变为 hex(V)，原样存储）
    const user = await this.prisma.user.create({
      data: {
        passwordHash: data.verifier,
        passwordSalt: data.salt,
        keyBlob: data.keyBlob,
        kdfParams: data.kdfParams,
      },
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

  async login(hash: string, notifyIp?: string) {
    // 检查全局锁定（先查锁再 pop：锁定期间的垃圾请求不烧码、不翻新码）
    if (this.loginLocker.isLocked()) {
      const error = new ErrorForbidden("登录失败次数过多，请一天后再试");
      error.data = this.loginLocker.getLockDetail();
      throw error;
    }

    // 验证 challenge（服务端自行 pop，无需客户端回传）；失败静默拒绝：仅 401，不通知不计数
    const challengeCode = this.challengeManager.popLastChallenge();
    if (!challengeCode) {
      throw new ErrorUnauthorized("挑战码无效或已过期");
    }

    const user = await this.prisma.user.findFirst();
    if (!user) {
      throw new ErrorAuthFailed();
    }

    // 验证密码: hash = SHA512(hex(V) + challengeCode)，V 存于 passwordHash
    const expectedHash = sha512(user.passwordHash + challengeCode);
    if (!timingSafeEqual(hash, expectedHash)) {
      const failIp = notifyIp ?? "未知来源";
      const lockDetail = this.loginLocker.recordLoginFail(failIp);
      await this.notificationService.createNotice(
        "密码错误",
        `${failIp} 在登录时输入了错误的密码，请检查是否为本人操作。`,
        NoticeType.Warning,
      );
      const error = new ErrorAuthFailed();
      error.message = lockDetail.isBanned
        ? "账号或密码错误，账号已被锁定"
        : `账号或密码错误，将在 ${lockDetail.retryNumber} 次后锁定登录`;
      error.data = lockDetail;
      throw error;
    }

    // 密码验证通过 = 已证明身份，失败计数清零（否则输错两次后再登对，
    // 要背着计数过一整天，直到跨天 cleanup）
    this.loginLocker.reset();

    // 创建 session
    const session = this.sessionManager.createSession();
    const expiresAt = new Date(
      session.createdAt + SESSION_ABSOLUTE_TIMEOUT_MS,
    ).toISOString();

    // 自动解锁无锁分组
    const groups = await this.prisma.group.findMany({
      orderBy: { order: "asc" },
    });
    for (const group of groups) {
      if (group.lockType === "None") {
        this.sessionManager.addUnlockedGroup(group.id);
      }
    }

    const hasNotice = await this.notificationService.hasUnread();

    return {
      token: session.token,
      /** 会话绝对过期时刻，前端倒计时以此为准（不依赖本地时钟校准） */
      expiresAt,
      theme: user.theme,
      initTime: user.initTime.toISOString(),
      defaultGroupId: user.defaultGroupId,
      hasNotice,
      withTotp: !!user.totpSecret,
      createPwdAlphabet: user.createPwdAlphabet,
      createPwdLength: user.createPwdLength,
      salt: user.passwordSalt,
      keyBlob: user.keyBlob,
      kdfParams: user.kdfParams,
      /** 凭证名称加密迁移标志：1=明文（前端登录后应提示迁移），2=已加密 */
      metadataVersion: user.metadataVersion,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        lockType: g.lockType,
        salt: g.passwordSalt || undefined,
        kdfParams: g.kdfParams || undefined,
      })),
    };
  }

  logout(): void {
    this.sessionManager.destroySession();
  }

  async changePassword(data: {
    verifier: string;
    hash: string;
    salt: string;
    keyBlob: string;
    totp?: string;
  }): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) throw new ErrorNeedLogin();

    const session = this.sessionManager.getCurrentSession();
    if (!session) throw new ErrorNeedLogin();

    const challengeCode = this.challengeManager.popLastChallenge();
    if (!challengeCode) {
      throw new ErrorUnauthorized("挑战码无效或已过期");
    }

    // 验证旧密码证明：hash = SHA512(hex(V_old) + challengeCode)，与 login 同构；
    // 失败从简：仅拒绝，不走锁定/通知
    const expectedHash = sha512(user.passwordHash + challengeCode);
    if (!timingSafeEqual(data.hash, expectedHash)) {
      throw new ErrorUnauthorized("旧密码验证失败");
    }

    // TOTP 校验（如启用）
    if (user.totpSecret) {
      const isValid = verifySync({
        token: data.totp ?? "",
        secret: user.totpSecret,
      }).valid;
      if (!isValid) {
        throw new ErrorUnauthorized("动态验证码错误");
      }
    }

    // O(1) re-wrap：凭证零改动，仅更新用户三字段，不销毁 session
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: data.verifier,
        passwordSalt: data.salt,
        keyBlob: data.keyBlob,
      },
    });
  }

  validateSession(token: string) {
    const session = this.sessionManager.getSession(token);
    if (!session) throw new ErrorNeedLogin();
    return session;
  }
}
