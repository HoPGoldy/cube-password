import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "./index";

describe("SessionManager（绝对超时）", () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SessionManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("createSession 返回带 createdAt 的 session，token 唯一", () => {
    const session = manager.createSession();
    expect(session.token).toEqual(expect.any(String));
    expect(session.createdAt).toBe(Date.now());

    const other = manager.createSession();
    expect(other.token).not.toBe(session.token);
  });

  it("未超时时 getSession / getCurrentSession 正常返回", () => {
    const session = manager.createSession();
    expect(manager.getSession(session.token)).toBe(session);
    expect(manager.getCurrentSession()).toBe(session);
  });

  it("token 不匹配返回 null 且不销毁现有会话", () => {
    manager.createSession();
    expect(manager.getSession("wrong-token")).toBeNull();
    expect(manager.getCurrentSession()).not.toBeNull();
  });

  it("绝对超时后即使持续活跃（反复 getSession）也判定过期并销毁", () => {
    const session = manager.createSession();

    // 每 30 秒活跃一次，连续 10 分钟内应始终有效
    for (let i = 0; i < 19; i++) {
      vi.advanceTimersByTime(30_000);
      expect(manager.getSession(session.token)).toBe(session);
    }

    // 距创建超过 10 分钟（600s 整点后再 +1ms）：最后一次活跃也无法续命
    vi.advanceTimersByTime(30_000 + 1);
    expect(manager.getSession(session.token)).toBeNull();
    expect(manager.getCurrentSession()).toBeNull();
  });

  it("恰好在超时边界（>10 分钟）过期，等于 10 分钟时仍存活", () => {
    const session = manager.createSession();

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(manager.getCurrentSession()).toBe(session);

    vi.advanceTimersByTime(1);
    expect(manager.getCurrentSession()).toBeNull();
  });

  it("getCurrentSession 在过期后同样销毁会话", () => {
    manager.createSession();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(manager.getCurrentSession()).toBeNull();
    // 会话已销毁，新 token 也无法复活
    expect(manager.getSession("any")).toBeNull();
  });

  it("destroySession 后 getSession / getCurrentSession 均为 null", () => {
    const session = manager.createSession();
    manager.destroySession();
    expect(manager.getSession(session.token)).toBeNull();
    expect(manager.getCurrentSession()).toBeNull();
  });

  it("unlockedGroupIds 的增删查仅作用于当前会话", () => {
    const session = manager.createSession();
    manager.addUnlockedGroup(1);
    expect(manager.isGroupUnlocked(1)).toBe(true);
    manager.removeUnlockedGroup(1);
    expect(manager.isGroupUnlocked(1)).toBe(false);

    // 换会话后解锁集合清零
    manager.createSession();
    expect(manager.isGroupUnlocked(1)).toBe(false);
    expect(session.unlockedGroupIds.size).toBe(0);
  });
});
