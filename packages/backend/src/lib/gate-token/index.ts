import { nanoid } from "nanoid";

/**
 * 门禁令牌有效期：3 分钟（防御性上限）。token 即取即用，单次登录流程秒级用完，
 * TTL 仅作兜底防异常流程下长期残留（见 docs/plans/ephemeral-gate-token/context.md 决策 6）
 */
export const GATE_TOKEN_TTL_MS = 3 * 60 * 1000;

interface GateTokenEntry {
  createdAt: number;
}

/**
 * 门禁令牌管理器（内存态，重启即失效）：
 * 设备验签通过后签发，用于访问门激活期间的预登录路由（X-Gate-Token header）。
 * 仅守护登录走廊，与 session（守房间）语义无关。
 */
export class GateTokenManager {
  private tokens = new Map<string, GateTokenEntry>();

  /** 签发一个新令牌 */
  createToken(): string {
    const token = nanoid(32);
    this.tokens.set(token, { createdAt: Date.now() });
    return token;
  }

  /** 校验令牌；过期即销毁并视为无效 */
  validateToken(token: string): boolean {
    const entry = this.tokens.get(token);
    if (!entry) return false;

    if (Date.now() - entry.createdAt > GATE_TOKEN_TTL_MS) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }
}
