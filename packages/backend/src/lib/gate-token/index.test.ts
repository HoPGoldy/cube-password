import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GateTokenManager, GATE_TOKEN_TTL_MS } from "./index";

describe("GateTokenManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("validates a freshly issued token", () => {
    const manager = new GateTokenManager();
    const token = manager.createToken();
    expect(manager.validateToken(token)).toBe(true);
  });

  it("rejects unknown and empty tokens", () => {
    const manager = new GateTokenManager();
    manager.createToken();
    expect(manager.validateToken("forged")).toBe(false);
    expect(manager.validateToken("")).toBe(false);
  });

  it("rejects a token after the 3 minute TTL", () => {
    const manager = new GateTokenManager();
    const token = manager.createToken();

    // TTL 边界内有效
    vi.advanceTimersByTime(GATE_TOKEN_TTL_MS - 1);
    expect(manager.validateToken(token)).toBe(true);

    // 超过 TTL 即失效（恰好等于 TTL 时仍有效，严格大于才过期）
    vi.advanceTimersByTime(2);
    expect(manager.validateToken(token)).toBe(false);
  });

  it("does not resurrect an expired token", () => {
    const manager = new GateTokenManager();
    const token = manager.createToken();
    vi.advanceTimersByTime(GATE_TOKEN_TTL_MS + 1);
    expect(manager.validateToken(token)).toBe(false);
    expect(manager.validateToken(token)).toBe(false);
  });
});
