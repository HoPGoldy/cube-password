import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChallengeManager } from "./index";

describe("ChallengeManager", () => {
  let manager: ChallengeManager;

  beforeEach(() => {
    manager = new ChallengeManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates and validates a challenge once (one-time consumption)", () => {
    const code = manager.generateChallenge();
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);

    expect(manager.validateChallenge(code)).toBe(true);
    // consumed: second validation fails
    expect(manager.validateChallenge(code)).toBe(false);
  });

  it("returns false for an unknown code without consuming anything", () => {
    expect(manager.validateChallenge("does-not-exist")).toBe(false);
  });

  it("popLastChallenge returns most recently generated challenge and pops it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));
    const first = manager.generateChallenge();

    vi.setSystemTime(new Date("2026-01-05T10:00:01Z"));
    const second = manager.generateChallenge();

    expect(manager.popLastChallenge()).toBe(second);
    expect(manager.popLastChallenge()).toBe(first);
    expect(manager.popLastChallenge()).toBeUndefined();
  });

  it("rejects an expired challenge on validate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));

    const code = manager.generateChallenge();

    // 5 minutes is exactly the timeout -> still valid at the edge
    vi.setSystemTime(new Date("2026-01-05T10:05:00Z"));
    expect(manager.validateChallenge(code)).toBe(true);

    const code2 = manager.generateChallenge();
    // just past the timeout -> rejected (and consumed)
    vi.setSystemTime(new Date("2026-01-05T10:10:01Z"));
    expect(manager.validateChallenge(code2)).toBe(false);
  });

  it("accepts a challenge exactly at the timeout edge and rejects just after it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));

    const code = manager.generateChallenge();

    // exactly 5 minutes later: still valid (timeout check is strict >)
    vi.setSystemTime(new Date("2026-01-05T10:05:00Z"));
    expect(manager.validateChallenge(code)).toBe(true);

    const code2 = manager.generateChallenge();
    // 1ms past 5 minutes: rejected (and consumed)
    vi.setSystemTime(new Date("2026-01-05T10:05:00Z"));
    expect(manager.validateChallenge(code2)).toBe(true);

    const code3 = manager.generateChallenge();
    vi.setSystemTime(new Date("2026-01-05T10:10:01Z"));
    expect(manager.validateChallenge(code3)).toBe(false);
  });

  it("refuses to return an expired challenge via popLastChallenge", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));

    manager.generateChallenge();
    vi.setSystemTime(new Date("2026-01-05T10:06:00Z"));

    expect(manager.popLastChallenge()).toBeUndefined();
  });

  it("cleans up expired entries on the next generate (no stale pops)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));

    manager.generateChallenge();
    vi.setSystemTime(new Date("2026-01-05T10:06:00Z"));

    // generate triggers cleanup, then adds a new challenge
    const fresh = manager.generateChallenge();
    expect(manager.popLastChallenge()).toBe(fresh);
    expect(manager.popLastChallenge()).toBeUndefined();
  });
});
