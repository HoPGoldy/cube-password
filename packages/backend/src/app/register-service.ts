import { PrismaService } from "@/modules/prisma";
import { registerAuthController } from "@/modules/auth/controller";
import { AuthService } from "@/modules/auth/service";
import { registerController as registerAppConfigController } from "@/modules/app-config/controller";
import { AppConfigService } from "@/modules/app-config/service";
import { registerUnifyResponse } from "@/lib/unify-response";
import type { FastifyInstance } from "fastify";
import type { AppInstance } from "@/types";
import { registerRemoveAdditionalProperties } from "@/lib/security";

import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { LoginLocker } from "@/lib/login-locker";
import { GateTokenManager } from "@/lib/gate-token";

import { NotificationService } from "@/modules/notification/service";
import { registerNotificationController } from "@/modules/notification/controller";
import { DeviceService } from "@/modules/device/service";
import { registerDeviceController } from "@/modules/device/controller";
import { ErrorDeviceGate } from "@/modules/device/error";
import { UserService } from "@/modules/user/service";
import { registerUserController } from "@/modules/user/controller";
import { GroupService } from "@/modules/group/service";
import { registerGroupController } from "@/modules/group/controller";
import { CertificateService } from "@/modules/certificate/service";
import { registerCertificateController } from "@/modules/certificate/controller";
import { OtpService } from "@/modules/otp/service";
import { registerOtpController } from "@/modules/otp/controller";

/**
 * 组装后端服务的主要业务功能
 * 这里手动进行了依赖注入，先创建 service，然后传递给 controller 使用
 */
/** 组装选项：允许注入 PrismaService（测试用临时库），默认新建 */
interface RegisterServiceOptions {
  prisma?: PrismaService;
}

export const registerService = async (
  instance: AppInstance,
  opts: RegisterServiceOptions = {},
) => {
  const prisma = opts.prisma ?? new PrismaService();

  await prisma.seed();

  // Lib 层实例
  const sessionManager = new SessionManager();
  const challengeManager = new ChallengeManager();
  const loginLocker = new LoginLocker();
  // 设备挑战码与门禁令牌：独立实例，与服务端登录挑战码/session 语义分离
  const deviceChallengeManager = new ChallengeManager();
  const gateTokenManager = new GateTokenManager();

  // Service 层实例
  const appConfigService = new AppConfigService({ prisma });
  const notificationService = new NotificationService({ prisma });

  const authService = new AuthService({
    prisma,
    sessionManager,
    challengeManager,
    loginLocker,
    notificationService,
  });

  const userService = new UserService({ prisma });

  const groupService = new GroupService({
    prisma,
    sessionManager,
    challengeManager,
  });

  const certificateService = new CertificateService({
    prisma,
    sessionManager,
  });

  const otpService = new OtpService({ prisma, challengeManager });

  const deviceService = new DeviceService({
    deviceChallengeManager,
    gateTokenManager,
    notificationService,
    appConfigService,
  });

  /** 设备门豁免的登录走廊路由（config.url 为含 /api 前缀的完整路径，见 context.md 3.5） */
  const GATE_EXEMPT_ROUTES = new Set([
    "/api/device/challenge",
    "/api/device/verify",
  ]);

  /**
   * 设备门禁 hook：注册顺序在 auth controller 的 session hook 之前。
   * 门开启时（唯一判定 = AppConfig deviceGateEnabled，每次直查无缓存），
   * 预登录路由（disableAuth: true）必须携带有效 X-Gate-Token，
   * 仅 /device/challenge|/device/verify 豁免；session 保护的常规路由
   * 不要求 gate token（gate 只守登录走廊，session 守房间）。
   * 未命中任何路由的请求（404）以及 swagger /docs（dev-only）经其 onRoute hook 标记 disableAuth，门开启时同样要求 gate token（比直觉更严格，方向安全）。
   */
  const app = instance as AppInstance;
  app.addHook("preHandler", async (request) => {
    const { url, disableAuth } = request.routeOptions.config;
    if (!disableAuth || !(await deviceService.isGateEnabled())) return;
    if (typeof url === "string" && GATE_EXEMPT_ROUTES.has(url)) return;

    const token = request.headers["x-gate-token"] as string | undefined;
    if (!token || !gateTokenManager.validateToken(token)) {
      throw new ErrorDeviceGate();
    }
  });

  const appControllerPlugin = async (server: FastifyInstance) => {
    const app = server as unknown as AppInstance;

    registerRemoveAdditionalProperties(server);
    registerUnifyResponse(server);

    registerAuthController({ server: app, authService });
    registerAppConfigController({ server: app });
    registerNotificationController({ server: app, notificationService });
    registerUserController({ server: app, userService });
    registerGroupController({ server: app, groupService });
    registerCertificateController({ server: app, certificateService });
    registerOtpController({ server: app, otpService });
    registerDeviceController({ server: app, deviceService });
  };

  await instance.register(appControllerPlugin, {
    prefix: "/api",
  });
};
