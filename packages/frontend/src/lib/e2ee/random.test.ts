import { describe, expect, it } from "vitest";
import { randomBytes } from "./random";

describe("randomBytes", () => {
  it("returns a Uint8Array of the requested length", () => {
    for (const length of [1, 8, 32, 64, 1024]) {
      const bytes = randomBytes(length);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toHaveLength(length);
    }
  });

  it("produces distinct output across calls (statistical)", () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("does not reuse the same input array", () => {
    const a = randomBytes(16);
    const b = randomBytes(16);
    expect(a).not.toBe(b);
  });

  it("rejects zero, negative and non-integer lengths", () => {
    expect(() => randomBytes(0)).toThrow();
    expect(() => randomBytes(-1)).toThrow();
    expect(() => randomBytes(1.5)).toThrow();
    expect(() => randomBytes(Number.NaN)).toThrow();
  });
});
