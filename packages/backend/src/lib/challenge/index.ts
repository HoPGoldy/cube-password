import { nanoid } from "nanoid";

const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

interface ChallengeEntry {
  code: string;
  createdAt: number;
}

export class ChallengeManager {
  private challenges: Map<string, ChallengeEntry> = new Map();

  generateChallenge(): string {
    this.cleanup();

    const code = nanoid(32);
    this.challenges.set(code, { code, createdAt: Date.now() });
    return code;
  }

  validateChallenge(code: string): boolean {
    const entry = this.challenges.get(code);
    if (!entry) return false;

    // 一次性消费
    this.challenges.delete(code);

    // 检查是否过期
    if (Date.now() - entry.createdAt > CHALLENGE_TIMEOUT_MS) {
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.challenges) {
      if (now - entry.createdAt > CHALLENGE_TIMEOUT_MS) {
        this.challenges.delete(key);
      }
    }
  }
}
