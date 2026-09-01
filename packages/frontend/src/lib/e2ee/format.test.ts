import { describe, expect, it } from "vitest";
import {
  ErrorInvalidV2Format,
  ErrorV2FormatUnexpectedSegmentCount,
  ErrorV2FormatUnsupportedAlgorithm,
  V2_ALG_AES_256_GCM,
  V2_ALG_PREFIX,
  buildV2,
  bytesToHex,
  hexToBytes,
  parseV2,
} from "./format";

const NONCE = "aabbccddeeff001122334455"; // 12 bytes
const CIPHERTEXT = "deadbeef";
const TAG = "00112233445566778899aabbccddeeff"; // 16 bytes
const VALID = `v2:aes-256-gcm:${NONCE}:${CIPHERTEXT}:${TAG}`;

describe("hexToBytes / bytesToHex", () => {
  it("round-trips", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0xfe, 0xff]);
    expect(bytesToHex(bytes)).toBe("0001feff");
    expect(hexToBytes("0001feff")).toEqual(bytes);
  });

  it("bytesToHex pads single-digit bytes", () => {
    expect(bytesToHex(new Uint8Array([0x0, 0x1, 0xa, 0xb]))).toBe("00010a0b");
  });

  it("bytesToHex handles empty arrays; hexToBytes rejects empty strings", () => {
    expect(bytesToHex(new Uint8Array())).toBe("");
    expect(() => hexToBytes("")).toThrow(ErrorInvalidV2Format);
  });

  it("hexToBytes rejects invalid hex", () => {
    expect(() => hexToBytes("zz")).toThrow(ErrorInvalidV2Format);
    expect(() => hexToBytes("abc")).toThrow(ErrorInvalidV2Format); // 奇数长度
    expect(() => hexToBytes("12 4")).toThrow(ErrorInvalidV2Format);
  });
});

describe("parseV2", () => {
  it("parses a valid v2 string", () => {
    const parsed = parseV2(VALID);
    expect(parsed.algorithm).toBe(V2_ALG_AES_256_GCM);
    expect(parsed.nonce).toEqual(hexToBytes(NONCE));
    expect(parsed.ciphertext).toEqual(hexToBytes(CIPHERTEXT));
    expect(parsed.tag).toEqual(hexToBytes(TAG));
  });

  it("accepts uppercase hex segments", () => {
    const parsed = parseV2(
      `v2:aes-256-gcm:${NONCE.toUpperCase()}:${CIPHERTEXT.toUpperCase()}:${TAG.toUpperCase()}`,
    );
    expect(parsed.nonce).toEqual(hexToBytes(NONCE));
  });

  it("accepts an empty ciphertext segment", () => {
    // 空明文加密时 ciphertext 可为 0 字节（tag 仍在）
    const parsed = parseV2(`v2:aes-256-gcm:${NONCE}::${TAG}`);
    expect(parsed.ciphertext).toEqual(new Uint8Array());
  });

  it("rejects a non-v2 prefix", () => {
    expect(() => parseV2("v1:aes-256-gcm:aa:bb:cc")).toThrow(
      ErrorInvalidV2Format,
    );
    expect(() => parseV2("aes-256-gcm:aa:bb:cc")).toThrow(ErrorInvalidV2Format);
    expect(() => parseV2("")).toThrow(ErrorInvalidV2Format);
  });

  it("rejects the wrong segment count", () => {
    // 4 段（少 tag）
    expect(() => parseV2(`v2:aes-256-gcm:${NONCE}:${CIPHERTEXT}`)).toThrow(
      ErrorV2FormatUnexpectedSegmentCount,
    );
    // 6 段（多一段）
    expect(() =>
      parseV2(`v2:aes-256-gcm:${NONCE}:${CIPHERTEXT}:${TAG}:extra`),
    ).toThrow(ErrorV2FormatUnexpectedSegmentCount);
  });

  it("rejects unsupported algorithms", () => {
    expect(() =>
      parseV2(`v2:aes-128-gcm:${NONCE}:${CIPHERTEXT}:${TAG}`),
    ).toThrow(ErrorV2FormatUnsupportedAlgorithm);
    expect(() => parseV2(`v2:xchacha20:${NONCE}:${CIPHERTEXT}:${TAG}`)).toThrow(
      ErrorV2FormatUnsupportedAlgorithm,
    );
  });

  it("rejects invalid hex in any segment", () => {
    expect(() => parseV2(`v2:aes-256-gcm:zz:${CIPHERTEXT}:${TAG}`)).toThrow(
      ErrorInvalidV2Format,
    );
    expect(() => parseV2(`v2:aes-256-gcm:${NONCE}:nothex:${TAG}`)).toThrow(
      ErrorInvalidV2Format,
    );
    expect(() =>
      parseV2(`v2:aes-256-gcm:${NONCE}:${CIPHERTEXT}:${TAG.slice(1)}`),
    ).toThrow(ErrorInvalidV2Format); // 奇数长度 tag
  });

  it("rejects a wrong nonce length (must be 12 bytes)", () => {
    const shortNonce = "aabbcc";
    expect(() =>
      parseV2(`v2:aes-256-gcm:${shortNonce}:${CIPHERTEXT}:${TAG}`),
    ).toThrow(/nonce/);
  });

  it("rejects a wrong tag length (must be 16 bytes)", () => {
    const shortTag = "aabb";
    expect(() =>
      parseV2(`v2:aes-256-gcm:${NONCE}:${CIPHERTEXT}:${shortTag}`),
    ).toThrow(/tag/);
  });

  it("rejects non-string input", () => {
    // strict: false 下 null / undefined 可赋给 string，但运行时仍需拦截
    expect(() => parseV2(null as unknown as string)).toThrow(
      ErrorInvalidV2Format,
    );
    expect(() => parseV2(undefined as unknown as string)).toThrow(
      ErrorInvalidV2Format,
    );
    // @ts-expect-error 测试运行时非法输入
    expect(() => parseV2(123)).toThrow(ErrorInvalidV2Format);
  });
});

describe("buildV2", () => {
  it("builds the canonical lowercase format", () => {
    const nonce = hexToBytes(NONCE);
    const ciphertext = hexToBytes(CIPHERTEXT);
    const tag = hexToBytes(TAG);

    expect(buildV2(V2_ALG_AES_256_GCM, nonce, ciphertext, tag)).toBe(VALID);
  });

  it("round-trips with parseV2", () => {
    const parsed = parseV2(VALID);
    expect(
      buildV2(parsed.algorithm, parsed.nonce, parsed.ciphertext, parsed.tag),
    ).toBe(VALID);
  });

  it("V2_ALG_PREFIX matches the canonical head of a built string", () => {
    const nonce = hexToBytes(NONCE);
    const built = buildV2(
      V2_ALG_AES_256_GCM,
      nonce,
      new Uint8Array(0),
      hexToBytes(TAG),
    );
    expect(built.startsWith(V2_ALG_PREFIX)).toBe(true);
  });
});
