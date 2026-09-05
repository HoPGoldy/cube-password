import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha512 } from "./index";

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
