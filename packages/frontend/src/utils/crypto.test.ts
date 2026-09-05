import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha512 } from "./crypto";

/**
 * 跨实现对拍：前端 @noble/hashes 与后端 node:crypto 的 SHA512 输出必须一致
 * （大写 hex）。后端参考实现见 packages/backend/src/lib/crypto/index.ts。
 */
const nodeSha512Upper = (str: string) =>
  createHash("sha512").update(str, "utf8").digest("hex").toUpperCase();

describe("sha512", () => {
  it("matches node:crypto output (uppercase hex)", () => {
    const vectors = [
      "",
      "abc",
      "challenge-code-123",
      "中文输入与 emoji 🔐 混合",
      "a".repeat(1000),
    ];
    for (const v of vectors) {
      expect(sha512(v)).toBe(nodeSha512Upper(v));
    }
  });

  it("returns uppercase 128-char hex", () => {
    const out = sha512("cube-password");
    expect(out).toMatch(/^[0-9A-F]{128}$/);
  });
});
