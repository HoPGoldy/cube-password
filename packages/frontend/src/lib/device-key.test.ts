import { describe, expect, it } from "vitest";
import {
  base64UrlToBytes,
  buildDeviceKey,
  bytesToBase64,
  bytesToBase64Url,
  DEVICE_KEY_PREFIX,
  ErrorInvalidDeviceKey,
  parseDeviceKey,
} from "./device-key";

/**
 * Node 侧参照实现（与后端 packages/backend/src/lib/device-key 的 serialize 逻辑一致），
 * 用于对拍浏览器原生 btoa/atob 实现的编解码结果。
 */
const nodeB64url = (str: string) =>
  Buffer.from(str, "utf8").toString("base64url");
const nodeB64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

const FAKE_SPKI_BASE64 =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEabc123def456XYZ789==";

describe("bytesToBase64 / bytesToBase64Url / base64UrlToBytes", () => {
  it("bytesToBase64 matches node:crypto output (incl. > 0x8000 chunk boundary)", () => {
    for (const length of [0, 1, 3, 255, 4096, 0x8000, 0x8001, 0x10000]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37) % 256);
      expect(bytesToBase64(bytes)).toBe(nodeB64(bytes));
    }
  });

  it("bytesToBase64Url uses URL-safe alphabet without padding", () => {
    // 这组字节的标准 base64 含 + / =，转 base64url 后必须消失
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 0xaf]);
    const std = bytesToBase64(bytes);
    expect(std).toMatch(/[+/=]/);
    const urlSafe = bytesToBase64Url(bytes);
    expect(urlSafe).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(urlSafe).toBe(
      std.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""),
    );
  });

  it("base64UrlToBytes round-trips with bytesToBase64Url", () => {
    for (const length of [0, 1, 2, 3, 31, 32, 33, 64]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 91 + 7) % 256);
      expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
    }
  });
});

describe("buildDeviceKey", () => {
  it("builds the canonical cube-device-key:v1 format", () => {
    const payload = { name: "MacBook", publicKey: FAKE_SPKI_BASE64 };
    const key = buildDeviceKey(payload);

    expect(key.startsWith(DEVICE_KEY_PREFIX)).toBe(true);
    expect(key).toBe(
      `cube-device-key:v1:${nodeB64url(JSON.stringify(payload))}`,
    );
  });

  it("produces URL-safe payload only (no +, / or =)", () => {
    const key = buildDeviceKey({
      name: "Chrome on Windows",
      publicKey: FAKE_SPKI_BASE64,
    });
    const payload = key.slice(DEVICE_KEY_PREFIX.length);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trips with parseDeviceKey", () => {
    const payload = { name: "中文设备名 🔐", publicKey: FAKE_SPKI_BASE64 };
    expect(parseDeviceKey(buildDeviceKey(payload))).toEqual(payload);
  });
});

describe("parseDeviceKey", () => {
  const buildKey = (payload: unknown) =>
    `cube-device-key:v1:${nodeB64url(JSON.stringify(payload))}`;

  it("parses a well-formed device key", () => {
    const payload = { name: "MacBook", publicKey: FAKE_SPKI_BASE64 };
    expect(parseDeviceKey(buildKey(payload))).toEqual(payload);
  });

  it("rejects wrong prefix / unknown version / empty input", () => {
    const good = buildKey({ name: "A", publicKey: "P" });

    expect(() => parseDeviceKey(good.replace("v1", "v9"))).toThrowError(
      ErrorInvalidDeviceKey,
    );
    expect(() => parseDeviceKey(`something-else-${good}`)).toThrowError(
      ErrorInvalidDeviceKey,
    );
    expect(() => parseDeviceKey("")).toThrowError(ErrorInvalidDeviceKey);
    expect(() => parseDeviceKey("cube-device-key:v1:")).toThrowError(
      ErrorInvalidDeviceKey,
    );
  });

  it("rejects invalid base64url payloads: charset, length, non-canonical encoding", () => {
    const payload = nodeB64url('{"name":"A","publicKey":"P"}');

    // 字符集越界（含 + / 或 =）
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${payload.slice(0, -1)}=`),
    ).toThrowError(ErrorInvalidDeviceKey);
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${payload.slice(0, -1)}/`),
    ).toThrowError(ErrorInvalidDeviceKey);

    // 长度 %4 === 1 必然非法
    expect(() => parseDeviceKey(`cube-device-key:v1:${payload}a`)).toThrowError(
      ErrorInvalidDeviceKey,
    );

    // 非规范编码：末位量化比特非零，可解码但不是规范 base64url
    const canonical = nodeB64url("hi");
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${canonical.slice(0, -1)}i`),
    ).toThrowError(ErrorInvalidDeviceKey);
  });

  it("rejects payloads that decode but are not valid JSON", () => {
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${nodeB64url("not json at all")}`),
    ).toThrowError(ErrorInvalidDeviceKey);
  });

  it("rejects JSON with missing or wrong-typed fields", () => {
    // 缺字段
    expect(() => parseDeviceKey(buildKey({ name: "A" }))).toThrowError(
      ErrorInvalidDeviceKey,
    );
    expect(() => parseDeviceKey(buildKey({ publicKey: "P" }))).toThrowError(
      ErrorInvalidDeviceKey,
    );
    expect(() => parseDeviceKey(buildKey({}))).toThrowError(
      ErrorInvalidDeviceKey,
    );

    // 类型不对 / 空字符串
    expect(() =>
      parseDeviceKey(buildKey({ name: 123, publicKey: "P" })),
    ).toThrowError(ErrorInvalidDeviceKey);
    expect(() =>
      parseDeviceKey(buildKey({ name: "", publicKey: "P" })),
    ).toThrowError(ErrorInvalidDeviceKey);
    expect(() =>
      parseDeviceKey(buildKey({ name: "A", publicKey: "" })),
    ).toThrowError(ErrorInvalidDeviceKey);
  });

  it("rejects non-string input (runtime guard despite TS types)", () => {
    expect(() => parseDeviceKey(null as unknown as string)).toThrowError(
      ErrorInvalidDeviceKey,
    );
    expect(() => parseDeviceKey(undefined as unknown as string)).toThrowError(
      ErrorInvalidDeviceKey,
    );
    expect(() => parseDeviceKey(123 as unknown as string)).toThrowError(
      ErrorInvalidDeviceKey,
    );
  });
});
