import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginLocker } from "./index";

describe("LoginLocker", () => {
  let locker: LoginLocker;

  beforeEach(() => {
    locker = new LoginLocker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isLocked", () => {
    it("locks an IP after 3 failures from the same IP in one day", () => {
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      expect(locker.isLocked("1.1.1.1")).toBe(false);

      locker.recordLoginFail("1.1.1.1", "loc-a");
      expect(locker.isLocked("1.1.1.1")).toBe(true);
    });

    it("does not lock with only 2 failures", () => {
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      expect(locker.isLocked("1.1.1.1")).toBe(false);
    });

    it("failures from different IPs do not lock each other", () => {
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      expect(locker.isLocked("1.1.1.1")).toBe(true);
      expect(locker.isLocked("2.2.2.2")).toBe(false);
    });
  });

  describe("getFailCount", () => {
    it("counts only records for the same IP on the same day", () => {
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("2.2.2.2", "loc-b");

      expect(locker.getFailCount("1.1.1.1")).toBe(2);
      expect(locker.getFailCount("2.2.2.2")).toBe(1);
      expect(locker.getFailCount("3.3.3.3")).toBe(0);
    });

    it("excludes same-IP records from a previous day (cleanup on read)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));

      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      expect(locker.getFailCount("1.1.1.1")).toBe(2);

      // days later: the previous records fall out of the daily window
      vi.setSystemTime(new Date("2026-01-11T12:00:00Z"));
      expect(locker.getFailCount("1.1.1.1")).toBe(0);
      expect(locker.isLocked("1.1.1.1")).toBe(false);
    });
  });

  describe("getLockDetail", () => {
    it("exposes retryNumber and isBanned reflecting remaining attempts", () => {
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");

      const detail = locker.getLockDetail();
      expect(detail.retryNumber).toBe(1);
      expect(detail.isBanned).toBe(false);
      expect(detail.loginFailure).toHaveLength(2);
    });

    it("marks banned with 0 retries after MAX_FAIL_COUNT failures", () => {
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");

      const detail = locker.getLockDetail();
      expect(detail.retryNumber).toBe(0);
      expect(detail.isBanned).toBe(true);
      expect(detail.loginFailure).toHaveLength(3);
    });

    it("does not trigger an isBanned state transiently over successive checks", () => {
      const first = locker.getLockDetail();
      expect(first.retryNumber).toBe(3);
      expect(first.isBanned).toBe(false);
    });
  });

  describe("daily cleanup", () => {
    it("cleans same-IP records across days when querying (fake timers affect dayjs)", () => {
      vi.useFakeTimers();
      // wide gap so the day boundary is crossed in ANY timezone (dayjs
      // compares local-time days, so avoid times that collide in local tz)
      vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));

      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      locker.recordLoginFail("1.1.1.1", "loc-a");
      expect(locker.isLocked("1.1.1.1")).toBe(true);

      // minutes later, still same day -> still locked
      vi.setSystemTime(new Date("2026-01-01T12:05:00Z"));
      expect(locker.isLocked("1.1.1.1")).toBe(true);

      // 10 days later -> cleanup drops the old records
      vi.setSystemTime(new Date("2026-01-11T12:00:00Z"));
      expect(locker.isLocked("1.1.1.1")).toBe(false);
      expect(locker.getFailCount("1.1.1.1")).toBe(0);
    });
  });
});
