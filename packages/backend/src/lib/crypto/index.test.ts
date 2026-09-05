import { createHash } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { sha512, validateReplayAttack } from "./index";

const nodeSha512Hex = (input: string) =>
  createHash("sha512").update(input).digest("hex");

describe("sha512", () => {
  it("returns uppercase hex matching node:crypto sha512", () => {
    const inputs = [
      "",
      "hello",
      "password123",
      "café ☕ 你好",
      "a".repeat(1000),
    ];
    for (const input of inputs) {
      expect(sha512(input)).toBe(nodeSha512Hex(input).toUpperCase());
    }
  });

  it("output is a 128-char uppercase hex string", () => {
    expect(sha512("anything")).toMatch(/^[0-9A-F]{128}$/);
  });
});

describe("validateReplayAttack", () => {
  const url = "/api/login";
  const nonce = "uuid-nonce-123";
  const secretKey = "secret-key-1";

  const buildSignature = (timestamp: number) =>
    sha512(`${url}${nonce}${timestamp}${secretKey}`);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a valid signature with a fresh timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:30Z"));
    const timestamp = Date.now() - 30 * 1000; // 30s ago

    expect(
      validateReplayAttack(
        url,
        nonce,
        timestamp,
        buildSignature(timestamp),
        secretKey,
      ),
    ).toBe(true);
  });

  it("accepts a signature at the exact edge (60s)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:30Z"));
    const timestamp = Date.now() - 60 * 1000;

    expect(
      validateReplayAttack(
        url,
        nonce,
        timestamp,
        buildSignature(timestamp),
        secretKey,
      ),
    ).toBe(true);
  });

  it("rejects an expired timestamp (>60s)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:30Z"));
    const timestamp = Date.now() - 60 * 1000 - 1;

    expect(
      validateReplayAttack(
        url,
        nonce,
        timestamp,
        buildSignature(timestamp),
        secretKey,
      ),
    ).toBe(false);
  });

  it("rejects a wrong signature", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:30Z"));
    const timestamp = Date.now() - 10 * 1000;

    expect(
      validateReplayAttack(
        url,
        nonce,
        timestamp,
        sha512("forged-signature"),
        secretKey,
      ),
    ).toBe(false);
  });

  it("rejects when the signature was built with a different secret", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:30Z"));
    const timestamp = Date.now() - 10 * 1000;

    const sigWithOtherSecret = sha512(`${url}${nonce}${timestamp}other-secret`);
    expect(
      validateReplayAttack(
        url,
        nonce,
        timestamp,
        sigWithOtherSecret,
        secretKey,
      ),
    ).toBe(false);
  });

  it("rejects when the nonce differs from the one the signature covers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T10:00:30Z"));
    const timestamp = Date.now() - 10 * 1000;

    expect(
      validateReplayAttack(
        url,
        "other-nonce",
        timestamp,
        buildSignature(timestamp),
        secretKey,
      ),
    ).toBe(false);
  });
});
