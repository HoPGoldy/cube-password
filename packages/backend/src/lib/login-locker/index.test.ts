import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginLocker } from "./index";

describe("LoginLocker", () => {
  let locker: LoginLocker;

  beforeEach(() => {
    locker = new LoginLocker();
  });

  afterEach(() => vi.useRealTimers());

  describe("isLocked", () => {
    it("locks globally after 3 failures in one day", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();
      expect(locker.isLocked()).toBe(false);

      locker.recordLoginFail();
      expect(locker.isLocked()).toBe(true);
    });

    it("does not lock with only 2 failures", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();
      expect(locker.isLocked()).toBe(false);
    });

    it("counts failures across sources cumulatively (global lock)", () => {
      // 三次失败无论来自什么来源，全局累计 3 次即锁
      locker.recordLoginFail();
      locker.recordLoginFail();
      locker.recordLoginFail();
      expect(locker.isLocked()).toBe(true);
    });
  });

  describe("getFailCount", () => {
    it("counts all records of the day regardless of source", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();
      locker.recordLoginFail();

      expect(locker.getFailCount()).toBe(3);
    });

    it("excludes records from a previous day (cleanup on read)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));

      locker.recordLoginFail();
      locker.recordLoginFail();
      expect(locker.getFailCount()).toBe(2);

      // days later: the previous records fall out of the daily window
      vi.setSystemTime(new Date("2026-01-11T12:00:00Z"));
      expect(locker.getFailCount()).toBe(0);
      expect(locker.isLocked()).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears failure count after successful login", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();

      locker.reset();

      expect(locker.getFailCount()).toBe(0);
      expect(locker.isLocked()).toBe(false);
    });

    it("counting restarts from zero after reset (2 more fails still unlocked)", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();
      locker.reset();
      locker.recordLoginFail();
      locker.recordLoginFail();

      expect(locker.isLocked()).toBe(false);
    });
  });

  describe("getLockDetail", () => {
    it("exposes retryNumber and isBanned reflecting remaining attempts", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();

      const detail = locker.getLockDetail();
      expect(detail.retryNumber).toBe(1);
      expect(detail.isBanned).toBe(false);
      expect(detail.loginFailure).toHaveLength(2);
    });

    it("marks banned with 0 retries after MAX_FAIL_COUNT failures", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();
      locker.recordLoginFail();

      const detail = locker.getLockDetail();
      expect(detail.retryNumber).toBe(0);
      expect(detail.isBanned).toBe(true);
      expect(detail.loginFailure).toHaveLength(3);
    });

    it("keeps the same counting basis as isLocked (global count)", () => {
      locker.recordLoginFail();
      locker.recordLoginFail();
      locker.recordLoginFail();

      expect(locker.getLockDetail().isBanned).toBe(true);
      expect(locker.isLocked()).toBe(true);
    });
  });

  describe("daily cleanup", () => {
    it("cleans records across days when querying (fake timers affect dayjs)", () => {
      vi.useFakeTimers();
      // wide gap so the day boundary is crossed in ANY timezone (dayjs
      // compares local-time days, so avoid times that collide in local tz)
      vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));

      locker.recordLoginFail();
      locker.recordLoginFail();
      locker.recordLoginFail();
      expect(locker.isLocked()).toBe(true);

      // minutes later, still same day -> still locked
      vi.setSystemTime(new Date("2026-01-01T12:05:00Z"));
      expect(locker.isLocked()).toBe(true);

      // 10 days later -> cleanup drops the old records
      vi.setSystemTime(new Date("2026-01-11T12:00:00Z"));
      expect(locker.isLocked()).toBe(false);
      expect(locker.getFailCount()).toBe(0);
    });
  });
});
