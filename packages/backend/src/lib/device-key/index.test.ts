import { describe, expect, it } from "vitest";
import { parseDeviceKey, serializeDeviceKey } from "./index";
import { ErrorBadRequest } from "@/types/error";

const b64url = (str: string) => Buffer.from(str, "utf8").toString("base64url");

/** 组装一个完整合法的钥匙串（正式流程由前端组装，这里仅测试用） */
const buildKey = (payload: unknown) =>
  `cube-device-key:v1:${b64url(JSON.stringify(payload))}`;

describe("parseDeviceKey", () => {
  it("parses a well-formed device key and round-trips with serialize", () => {
    const payload = {
      name: "MacBook",
      publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEabc123",
    };
    const key = `cube-device-key:v1:${b64url(JSON.stringify(payload))}`;

    expect(parseDeviceKey(key)).toEqual(payload);
    expect(serializeDeviceKey(payload)).toBe(key);
    expect(parseDeviceKey(serializeDeviceKey(payload))).toEqual(payload);
  });

  it("rejects wrong prefix / unknown version / empty input", () => {
    const good = buildKey({ name: "A", publicKey: "P" });

    expect(() => parseDeviceKey(good.replace("v1", "v9"))).toThrowError(
      ErrorBadRequest,
    );
    expect(() => parseDeviceKey(`something-else-${good}`)).toThrowError(
      ErrorBadRequest,
    );
    expect(() => parseDeviceKey("")).toThrowError(ErrorBadRequest);
    expect(() => parseDeviceKey("cube-device-key:v1:")).toThrowError(
      ErrorBadRequest,
    );
  });

  it("rejects invalid base64url payloads: charset, length, non-canonical padding bits", () => {
    const payload = b64url('{"name":"A","publicKey":"P"}');

    // 字符集越界（含 + / 或 =）
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${payload.slice(0, -1)}=`),
    ).toThrowError(ErrorBadRequest);
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${payload.slice(0, -1)}/`),
    ).toThrowError(ErrorBadRequest);

    // 长度 %4 === 1 必然非法
    expect(() => parseDeviceKey(`cube-device-key:v1:${payload}a`)).toThrowError(
      ErrorBadRequest,
    );

    // 非规范编码：末位量化比特非零，可解码但不是规范 base64url
    const canonical = b64url("hi");
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${canonical.slice(0, -1)}i`),
    ).toThrowError(ErrorBadRequest);
  });

  it("rejects payloads that decode but are not valid JSON", () => {
    expect(() =>
      parseDeviceKey(`cube-device-key:v1:${b64url("not json at all")}`),
    ).toThrowError(ErrorBadRequest);
  });

  it("rejects JSON with missing or wrong-typed fields", () => {
    // 缺字段
    expect(() => parseDeviceKey(buildKey({ name: "A" }))).toThrowError(
      ErrorBadRequest,
    );
    expect(() => parseDeviceKey(buildKey({ publicKey: "P" }))).toThrowError(
      ErrorBadRequest,
    );
    expect(() => parseDeviceKey(buildKey({}))).toThrowError(ErrorBadRequest);

    // 类型不对 / 空字符串
    expect(() =>
      parseDeviceKey(buildKey({ name: 123, publicKey: "P" })),
    ).toThrowError(ErrorBadRequest);
    expect(() =>
      parseDeviceKey(buildKey({ name: "A", publicKey: true })),
    ).toThrowError(ErrorBadRequest);
    expect(() =>
      parseDeviceKey(buildKey({ name: "", publicKey: "P" })),
    ).toThrowError(ErrorBadRequest);

    // 整体不是对象
    expect(() => parseDeviceKey(buildKey(["A", "P"]))).toThrowError(
      ErrorBadRequest,
    );
    expect(() => parseDeviceKey(buildKey("just a string"))).toThrowError(
      ErrorBadRequest,
    );
    expect(() => parseDeviceKey(buildKey(null))).toThrowError(ErrorBadRequest);
  });
});

describe("serializeDeviceKey", () => {
  it("produces the documented cube-device-key:v1 format", () => {
    const key = serializeDeviceKey({
      name: "MacBook",
      publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExyz789",
    });

    expect(key.startsWith("cube-device-key:v1:")).toBe(true);
    // 钥匙串不含 =/+// 等需转义的字符，可直接粘贴进 JSON 文件或 URL
    expect(/^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)+$/.test(key)).toBe(true);
    expect(key).not.toMatch(/[=+/]/);
  });
});
