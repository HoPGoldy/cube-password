import { describe, expect, it } from "vitest";
import {
  formatSessionCountdown,
  getSessionRemainingMs,
  isSessionCountdownWarning,
} from "./use-session-countdown";

describe("formatSessionCountdown", () => {
  it("mm:ss 格式，不足补零", () => {
    expect(formatSessionCountdown(10 * 60 * 1000)).toBe("10:00");
    expect(formatSessionCountdown(9 * 60 * 1000 + 5_000)).toBe("09:05");
    expect(formatSessionCountdown(0)).toBe("00:00");
  });

  it("亚秒截断，不虚高", () => {
    expect(formatSessionCountdown(1_900)).toBe("00:01");
    expect(formatSessionCountdown(59_999)).toBe("00:59");
  });

  it("负数（已过期）钳制为 00:00", () => {
    expect(formatSessionCountdown(-1)).toBe("00:00");
    expect(formatSessionCountdown(-120_000)).toBe("00:00");
  });
});

describe("getSessionRemainingMs", () => {
  it("以 expiresAt 与 now 做差，不依赖本地校准", () => {
    const expiresAt = "2026-01-01T12:10:00.000Z";
    expect(
      getSessionRemainingMs(expiresAt, Date.parse("2026-01-01T12:00:00.000Z")),
    ).toBe(10 * 60 * 1000);
    expect(
      getSessionRemainingMs(expiresAt, Date.parse("2026-01-01T12:09:30.500Z")),
    ).toBe(29_500);
  });

  it("过期后返回负数", () => {
    const expiresAt = "2026-01-01T12:10:00.000Z";
    expect(
      getSessionRemainingMs(expiresAt, Date.parse("2026-01-01T12:10:00.001Z")),
    ).toBe(-1);
  });
});

describe("isSessionCountdownWarning", () => {
  it("最后 1 分钟（含边界）为警示", () => {
    expect(isSessionCountdownWarning(60_001)).toBe(false);
    expect(isSessionCountdownWarning(60_000)).toBe(true);
    expect(isSessionCountdownWarning(0)).toBe(true);
    expect(isSessionCountdownWarning(-1_000)).toBe(true);
  });
});
