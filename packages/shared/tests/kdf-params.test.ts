import { describe, expect, it } from "vitest";
import {
  DEFAULT_KDF_PARAMS,
  ErrorInvalidKdfParams,
  parseKdfParams,
} from "../src/kdf-params";

describe("parseKdfParams", () => {
  it("parses a valid kdfParams JSON string", () => {
    const raw = JSON.stringify(DEFAULT_KDF_PARAMS);
    expect(parseKdfParams(raw)).toEqual(DEFAULT_KDF_PARAMS);
  });

  it("rejects invalid JSON with a clear error", () => {
    expect(() => parseKdfParams("{not-json")).toThrow(ErrorInvalidKdfParams);
    expect(() => parseKdfParams("{not-json")).toThrow(/JSON/);
  });

  it("rejects non-object JSON", () => {
    expect(() => parseKdfParams('"argon2id"')).toThrow(ErrorInvalidKdfParams);
    expect(() => parseKdfParams("42")).toThrow(ErrorInvalidKdfParams);
    expect(() => parseKdfParams("null")).toThrow(ErrorInvalidKdfParams);
  });

  it("rejects unknown algorithm (no silent fallback to defaults)", () => {
    const raw = JSON.stringify({
      ...DEFAULT_KDF_PARAMS,
      algorithm: "pbkdf2",
    });
    expect(() => parseKdfParams(raw)).toThrow(/不支持的 KDF 算法/);
  });

  it("rejects unknown version (no silent fallback to defaults)", () => {
    const raw = JSON.stringify({ ...DEFAULT_KDF_PARAMS, version: 2 });
    expect(() => parseKdfParams(raw)).toThrow(/不支持的 kdfParams 版本/);
  });

  it("rejects missing or mistyped fields", () => {
    const cases = [
      JSON.stringify({ ...DEFAULT_KDF_PARAMS, m: "65536" }), // m 非数字
      JSON.stringify({ ...DEFAULT_KDF_PARAMS, t: 0 }), // t < 1
      JSON.stringify({ ...DEFAULT_KDF_PARAMS, p: 1.5 }), // p 非整数
      JSON.stringify({ algorithm: "argon2id", t: 2, p: 1, version: 1 }), // 缺 m
      JSON.stringify({ algorithm: "argon2id" }), // 缺 m/t/p/version
    ];
    for (const raw of cases) {
      expect(() => parseKdfParams(raw)).toThrow(ErrorInvalidKdfParams);
    }
  });

  it("rejects m below the argon2 minimum for the given parallelism", () => {
    const raw = JSON.stringify({ ...DEFAULT_KDF_PARAMS, m: 1 });
    expect(() => parseKdfParams(raw)).toThrow(/kdfParams\.m/);
  });
});
