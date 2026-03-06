import { AppInstance } from "@/types";
import {
  SchemaChallengeResponse,
  SchemaGlobalResponse,
  SchemaAuthInitBody,
  SchemaAuthInitResponse,
  SchemaAuthLoginBody,
  SchemaAuthLoginResponse,
  SchemaAuthChangePasswordBody,
} from "@/types/auth";
import { ErrorUnauthorized } from "@/types/error";
import { ErrorNeedLogin } from "./error";
import { validateReplayAttack } from "@/lib/crypto";
import { AuthService } from "./service";

declare module "fastify" {
  interface FastifyContextConfig {
    /** 是否禁用认证（允许公开访问） */
    disableAuth?: boolean;
  }
}

interface RegisterOptions {
  server: AppInstance;
  authService: AuthService;
}

export const registerAuthController = (options: RegisterOptions) => {
  const { server, authService } = options;

  // Session + Replay Attack 认证 hook
  server.addHook("preHandler", async (request) => {
    const { disableAuth } = request.routeOptions.config;
    if (disableAuth) return;

    const token = request.headers["x-session-token"] as string;
    if (!token) throw new ErrorNeedLogin();

    const session = authService.validateSession(token);

    // 验证防重放攻击
    const nonce = request.headers["x-nonce"] as string;
    const timestamp = Number(request.headers["x-timestamp"]);
    const signature = request.headers["x-signature"] as string;

    if (nonce && timestamp && signature) {
      const url = "api" + request.url.split("/api")[1].split("?")[0];
      const valid = validateReplayAttack(
        url,
        nonce,
        timestamp,
        signature,
        session.replayAttackSecret,
      );
      if (!valid) throw new ErrorUnauthorized("请求签名无效");
    }
  });

  // GET /api/challenge — 获取挑战码
  server.get(
    "/challenge",
    {
      config: { disableAuth: true },
      schema: {
        description: "获取登录挑战码",
        tags: ["auth"],
        response: { 200: SchemaChallengeResponse },
      },
    },
    async () => {
      return { code: authService.getChallenge() };
    },
  );

  // GET /api/global — 获取初始化状态
  server.get(
    "/global",
    {
      config: { disableAuth: true },
      schema: {
        description: "获取全局配置",
        tags: ["auth"],
        response: { 200: SchemaGlobalResponse },
      },
    },
    async () => {
      return { isInitialized: await authService.isInitialized() };
    },
  );

  // POST /api/auth/init — 初始化用户
  server.post(
    "/auth/init",
    {
      config: { disableAuth: true },
      schema: {
        description: "初始化用户（仅限首次）",
        tags: ["auth"],
        body: SchemaAuthInitBody,
        response: { 200: SchemaAuthInitResponse },
      },
    },
    async (request) => {
      const { passwordHash } = request.body;
      await authService.init(passwordHash);
      return { success: true };
    },
  );

  // POST /api/auth/login — 登录
  server.post(
    "/auth/login",
    {
      config: { disableAuth: true },
      schema: {
        description: "用户登录",
        tags: ["auth"],
        body: SchemaAuthLoginBody,
        response: { 200: SchemaAuthLoginResponse },
      },
    },
    async (request) => {
      const { hash, challengeCode, code } = request.body;
      const ip = request.ip;
      return await authService.login(hash, challengeCode, ip, code);
    },
  );

  // POST /api/auth/logout — 登出
  server.post(
    "/auth/logout",
    {
      schema: {
        description: "登出",
        tags: ["auth"],
      },
    },
    async () => {
      authService.logout();
      return {};
    },
  );

  // POST /api/auth/change-password — 修改密码
  server.post(
    "/auth/change-password",
    {
      schema: {
        description: "修改密码",
        tags: ["auth"],
        body: SchemaAuthChangePasswordBody,
      },
    },
    async (request) => {
      const { oldHash, challengeCode, newPasswordHash } = request.body;
      await authService.changePassword(oldHash, challengeCode, newPasswordHash);
      return {};
    },
  );
};
