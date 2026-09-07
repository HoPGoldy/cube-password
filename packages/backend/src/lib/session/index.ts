import { nanoid } from "nanoid";

/** 会话绝对超时：距创建 10 分钟后无论是否活跃都过期 */
export const SESSION_ABSOLUTE_TIMEOUT_MS = 10 * 60 * 1000;

export interface UserSession {
  token: string;
  unlockedGroupIds: Set<number>;
  /** 创建时刻（绝对超时的唯一判定基准，活跃不续期） */
  createdAt: number;
}

export class SessionManager {
  private session: UserSession | null = null;

  /** 单用户单 session，登录即销毁旧会话 */
  createSession(): UserSession {
    this.destroySession();

    this.session = {
      token: nanoid(32),
      unlockedGroupIds: new Set(),
      createdAt: Date.now(),
    };

    return this.session;
  }

  /** 绝对超时判定：过期则就地销毁并返回 false */
  private isAlive(session: UserSession): boolean {
    if (Date.now() - session.createdAt > SESSION_ABSOLUTE_TIMEOUT_MS) {
      this.destroySession();
      return false;
    }
    return true;
  }

  getSession(token: string): UserSession | null {
    if (!this.session || this.session.token !== token) {
      return null;
    }
    return this.isAlive(this.session) ? this.session : null;
  }

  destroySession(): void {
    this.session = null;
  }

  removeUnlockedGroup(groupId: number): void {
    if (this.session) {
      this.session.unlockedGroupIds.delete(groupId);
    }
  }

  addUnlockedGroup(groupId: number): void {
    if (this.session) {
      this.session.unlockedGroupIds.add(groupId);
    }
  }

  isGroupUnlocked(groupId: number): boolean {
    return this.session?.unlockedGroupIds.has(groupId) ?? false;
  }

  /** 已解锁分组 id 集合快照（登出/超时后为空数组） */
  getUnlockedGroupIds(): number[] {
    if (!this.session) return [];
    return Array.from(this.session.unlockedGroupIds);
  }

  getCurrentSession(): UserSession | null {
    if (!this.session) return null;
    return this.isAlive(this.session) ? this.session : null;
  }
}
