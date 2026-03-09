import { nanoid } from "nanoid";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

export interface UserSession {
  token: string;
  replayAttackSecret: string;
  unlockedGroupIds: Set<number>;
  lastActiveTime: number;
}

export class SessionManager {
  private session: UserSession | null = null;

  createSession(): UserSession {
    // 单用户单 session，先销毁旧的
    this.destroySession();

    this.session = {
      token: nanoid(32),
      replayAttackSecret: nanoid(32),
      unlockedGroupIds: new Set(),
      lastActiveTime: Date.now(),
    };

    return this.session;
  }

  getSession(token: string): UserSession | null {
    if (!this.session || this.session.token !== token) {
      return null;
    }

    // 检查是否超时
    if (Date.now() - this.session.lastActiveTime > SESSION_TIMEOUT_MS) {
      this.destroySession();
      return null;
    }

    // 续期
    this.session.lastActiveTime = Date.now();
    return this.session;
  }

  destroySession(): void {
    this.session = null;
  }

  addUnlockedGroup(groupId: number): void {
    if (this.session) {
      this.session.unlockedGroupIds.add(groupId);
    }
  }

  isGroupUnlocked(groupId: number): boolean {
    return this.session?.unlockedGroupIds.has(groupId) ?? false;
  }

  getCurrentSession(): UserSession | null {
    if (!this.session) return null;
    if (Date.now() - this.session.lastActiveTime > SESSION_TIMEOUT_MS) {
      this.destroySession();
      return null;
    }
    return this.session;
  }
}
