import { nanoid } from "nanoid";

const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

interface ChallengeEntry {
  code: string;
  createdAt: number;
}

/**
 * 全局单槽位挑战码：同一时刻只存在一个有效挑战码。
 * generateChallenge 生成即覆盖旧值；pop/validate 取走后槽位置空（一次性消费）。
 */
export class ChallengeManager {
  private challenge: ChallengeEntry | undefined;

  generateChallenge(): string {
    const code = nanoid(32);
    this.challenge = { code, createdAt: Date.now() };
    return code;
  }

  validateChallenge(code: string): boolean {
    const entry = this.challenge;
    if (!entry || entry.code !== code) return false;

    // 一次性消费
    this.challenge = undefined;

    // 检查是否过期
    if (Date.now() - entry.createdAt > CHALLENGE_TIMEOUT_MS) {
      return false;
    }

    return true;
  }

  /** 弹出当前挑战码（用于登录/修改密码等场景），取走后槽位置空 */
  popLastChallenge(): string | undefined {
    const entry = this.challenge;
    if (!entry) return undefined;

    this.challenge = undefined;
    if (Date.now() - entry.createdAt > CHALLENGE_TIMEOUT_MS) {
      return undefined;
    }
    return entry.code;
  }
}
