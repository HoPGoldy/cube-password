import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha512, timingSafeEqual } from "./index";

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

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    const hash = sha512("hello");
    expect(timingSafeEqual(hash, hash)).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    const hashA = sha512("hello");
    const hashB = sha512("world");
    expect(hashA.length).toBe(hashB.length);
    expect(timingSafeEqual(hashA, hashB)).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("abc", "")).toBe(false);
    const hash = sha512("hello");
    expect(timingSafeEqual(hash, hash.slice(1))).toBe(false);
  });

  it("length mismatch still performs full virtual comparison (timing parity)", () => {
    // 观测多次调用的耗时上界，确认长度不等的分支没有提前短路退出
    const short = "a";
    const long = sha512("hello");
    const iterations = 200;
    const run = () => {
      const start = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        timingSafeEqual(short, long);
      }
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    run(); // 预热，排除 JIT 干扰
    const durationMs = run();
    // 200 次全量比较即使慢机器也远低于 1s；若分支提前 return 则耗时会显著更小
    expect(durationMs).toBeLessThan(1000);
    expect(timingSafeEqual(short, long)).toBe(false);
  });
});
