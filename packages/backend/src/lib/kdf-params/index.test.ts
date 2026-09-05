import { describe, expect, it } from "vitest";
import { parseGroupKdfParams } from "./index";

const VALID = {
  algorithm: "argon2id",
  m: 65536,
  t: 2,
  p: 1,
  version: 1,
};

describe("parseGroupKdfParams", () => {
  it("parses a valid kdfParams JSON string", () => {
    expect(parseGroupKdfParams(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("accepts non-default but structurally valid params (lenient version)", () => {
    // version 校验为「数字」即可（宽松解析），不限定具体值
    expect(
      parseGroupKdfParams(JSON.stringify({ ...VALID, m: 32768, version: 2 })),
    ).toEqual({ ...VALID, m: 32768, version: 2 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGroupKdfParams("{not-json")).toThrow(SyntaxError);
  });

  it("throws on non-object JSON", () => {
    expect(() => parseGroupKdfParams('"argon2id"')).toThrow();
    expect(() => parseGroupKdfParams("42")).toThrow();
    expect(() => parseGroupKdfParams("null")).toThrow();
  });

  it("throws on unknown algorithm", () => {
    expect(() =>
      parseGroupKdfParams(JSON.stringify({ ...VALID, algorithm: "pbkdf2" })),
    ).toThrow(/不支持的 KDF 算法/);
  });

  it("throws on missing or mistyped fields", () => {
    const cases = [
      JSON.stringify({ ...VALID, m: "65536" }),
      JSON.stringify({ ...VALID, t: 0 }),
      JSON.stringify({ ...VALID, p: 1.5 }),
      JSON.stringify({ ...VALID, version: "1" }),
      JSON.stringify({ algorithm: "argon2id", t: 2, p: 1, version: 1 }),
      JSON.stringify({ algorithm: "argon2id" }),
    ];
    for (const raw of cases) {
      expect(() => parseGroupKdfParams(raw)).toThrow();
    }
  });

  it("throws on m below the argon2 minimum for the given parallelism", () => {
    expect(() =>
      parseGroupKdfParams(JSON.stringify({ ...VALID, m: 1 })),
    ).toThrow(/kdfParams\.m/);
  });
});
