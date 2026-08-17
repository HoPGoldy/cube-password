import { createHash } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  aesDecrypt,
  aesEncrypt,
  getAesMeta,
  sha512,
  shaWithSalt,
  validateReplayAttack,
} from "./index";

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

describe("shaWithSalt", () => {
  it("double-hashes the salt before concatenating with the message", () => {
    const str = "my-password";
    const saltValue = "some-salt";

    // reference computation: SHA512(SHA512(saltValue).hex + str), uppercase
    const saltHex = nodeSha512Hex(saltValue);
    const expected = nodeSha512Hex(saltHex + str).toUpperCase();

    expect(shaWithSalt(str, saltValue)).toBe(expected);
    // must NOT be the raw-salt variant
    expect(shaWithSalt(str, saltValue)).not.toBe(
      nodeSha512Hex(saltValue + str).toUpperCase(),
    );
    // salt change changes the hash
    expect(shaWithSalt(str, saltValue)).not.toBe(
      shaWithSalt(str, "other-salt"),
    );
  });

  it("handles empty salt and empty str", () => {
    // SHA512(SHA512("").hex + "") = SHA512 of the 128-char empty-salt hex
    expect(shaWithSalt("", "")).toBe(
      nodeSha512Hex(nodeSha512Hex("")).toUpperCase(),
    );
  });
});

describe("AES round trip", () => {
  const samples = [
    "hello world",
    "",
    "p@ssw0rd with ünïcode 中文 🎉",
    "x".repeat(1000),
  ];

  it("aesEncrypt -> aesDecrypt restores the original string", () => {
    for (const sample of samples) {
      const { key, iv } = getAesMeta("my-secret-password");
      const encrypted = aesEncrypt(sample, key, iv);
      const decrypted = aesDecrypt(encrypted, key, iv);
      expect(decrypted).toBe(sample);
    }
  });

  it("produces different ciphertext for different passwords but decrypts each correctly", () => {
    const plain = "sensitive payload";
    const metaA = getAesMeta("password-A");
    const metaB = getAesMeta("password-B");

    const encA = aesEncrypt(plain, metaA.key, metaA.iv);
    const encB = aesEncrypt(plain, metaB.key, metaB.iv);

    expect(encA).not.toBe(encB);
    expect(aesDecrypt(encA, metaA.key, metaA.iv)).toBe(plain);
    expect(aesDecrypt(encB, metaB.key, metaB.iv)).toBe(plain);
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
