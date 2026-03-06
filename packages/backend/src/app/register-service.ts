import { PrismaService } from "@/modules/prisma";
import { registerAuthController } from "@/modules/auth/controller";
import { AuthService } from "@/modules/auth/service";
import { registerController as registerAppConfigController } from "@/modules/app-config/controller";
import { AppConfigService } from "@/modules/app-config/service";
import { registerUnifyResponse } from "@/lib/unify-response";
import type { AppInstance } from "@/types";
import { AccessTokenService } from "@/modules/access-token/service";
import { registerAccessTokenController } from "@/modules/access-token/controller";
import { registerRemoveAdditionalProperties } from "@/lib/security";

import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { LoginLocker } from "@/lib/login-locker";

import { NotificationService } from "@/modules/notification/service";
import { registerNotificationController } from "@/modules/notification/controller";
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
export const registerService = async (instance: AppInstance) => {
  const prisma = new PrismaService();

  await prisma.seed();

  // Lib 层实例
  const sessionManager = new SessionManager();
  const challengeManager = new ChallengeManager();
  const loginLocker = new LoginLocker();

  // Service 层实例
  const appConfigService = new AppConfigService({ prisma });
  const accessTokenService = new AccessTokenService({ prisma });
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

  const appControllerPlugin = async (server: AppInstance) => {
    registerRemoveAdditionalProperties(server);
    registerUnifyResponse(server);

    registerAuthController({ server, authService });
    registerAppConfigController({ appConfigService, server });
    registerAccessTokenController({ server, accessTokenService });
    registerNotificationController({ server, notificationService });
    registerUserController({ server, userService });
    registerGroupController({ server, groupService });
    registerCertificateController({ server, certificateService });
    registerOtpController({ server, otpService });
  };

  await instance.register(appControllerPlugin, {
    prefix: "/api",
  });
};
