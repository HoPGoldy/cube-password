import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * passGate 纯逻辑编排测试：mock 掉 requestPost（网络层）与 lib/device-key
 * （IndexedDB/WebCrypto 层），只验证「取钥匙 → 签名 → verify」编排与错误分类。
 */

const requestPostMock = vi.fn();
vi.mock("./base", () => ({
  requestPost: (...args: unknown[]) => requestPostMock(...args),
}));

const listLocalDeviceKeysMock = vi.fn();
const silentVerifyMock = vi.fn();
vi.mock("@/lib/device-key", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/device-key")>();
  return {
    ...original,
    listLocalDeviceKeys: () => listLocalDeviceKeysMock(),
    silentVerify: (...args: unknown[]) => silentVerifyMock(...args),
  };
});

import {
  ErrorGateDenied,
  ErrorGateUnavailable,
  clearGateToken,
  getValidGateToken,
  isDeviceGateRejection,
  passGate,
  setGateToken,
  toGateDenial,
} from "./device-gate";
import { ErrorNoLocalDeviceKey } from "@/lib/device-key";

const httpGateError = () => {
  const err = new Error("此设备未授权访问");
  (err as any).response = {
    status: 403,
    data: { success: false, code: 40301, message: "此设备未授权访问" },
  };
  return err;
};

beforeEach(() => {
  requestPostMock.mockReset();
  listLocalDeviceKeysMock.mockReset();
  silentVerifyMock.mockReset();
  clearGateToken();
});

describe("gate token 内存态", () => {
  it("setGateToken 后 getValidGateToken 返回令牌，clearGateToken 后清空", () => {
    expect(getValidGateToken()).toBeUndefined();
    setGateToken("token-1");
    expect(getValidGateToken()).toBe("token-1");
    clearGateToken();
    expect(getValidGateToken()).toBeUndefined();
  });

  it("超过 10 分钟有效期后视为过期并丢弃", () => {
    setGateToken("token-old");
    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      expect(getValidGateToken()).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("isDeviceGateRejection", () => {
  it("识别 403 + code 40301", () => {
    expect(isDeviceGateRejection(httpGateError())).toBe(true);
  });

  it("其他 403 / 其他 code / 非网络错误均不识别", () => {
    const forbidden = new Error("403");
    (forbidden as any).response = {
      status: 403,
      data: { code: 40300 },
    };
    expect(isDeviceGateRejection(forbidden)).toBe(false);
    expect(isDeviceGateRejection(new Error("boom"))).toBe(false);
    expect(isDeviceGateRejection(undefined)).toBe(false);
  });
});

describe("passGate", () => {
  const CHALLENGE = "challenge-abc";
  const localKey = (deviceId?: string) => ({
    deviceId,
    name: "Chrome on macOS",
    publicKey: "MFkw...==",
    createdAt: "2026-01-01T00:00:00.000Z",
    privateKey: {} as CryptoKey,
  });

  it("成功：用已关联 deviceId 的钥匙签名并换 gate token", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockResolvedValue("sig-bytes");
    requestPostMock.mockResolvedValue({
      success: true,
      code: 200,
      data: { gateToken: "gate-token-1" },
    });

    const { gateToken } = await passGate(CHALLENGE);

    expect(gateToken).toBe("gate-token-1");
    expect(silentVerifyMock).toHaveBeenCalledWith("device-1", CHALLENGE);
    expect(requestPostMock).toHaveBeenCalledWith("device/verify", {
      deviceId: "device-1",
      challenge: CHALLENGE,
      signature: "sig-bytes",
    });
  });

  it("本机只有 pending 钥匙时按序回退：优先已关联 id，其次 pending", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([
      localKey(undefined),
      localKey("device-2"),
    ]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockResolvedValue({
      success: true,
      code: 200,
      data: { gateToken: "t" },
    });

    await passGate(CHALLENGE);

    expect(silentVerifyMock).toHaveBeenCalledWith("device-2", CHALLENGE);
  });

  it("pending 槽位记录 deviceId 字段缺省时向 verify 传 undefined", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey(undefined)]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockResolvedValue({
      success: true,
      code: 200,
      data: { gateToken: "t" },
    });

    await passGate(CHALLENGE);

    expect(requestPostMock).toHaveBeenCalledWith("device/verify", {
      deviceId: undefined,
      challenge: CHALLENGE,
      signature: "sig",
    });
  });

  it("本机无任何钥匙 → ErrorGateDenied", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([]);
    await expect(passGate(CHALLENGE)).rejects.toThrowError(ErrorGateDenied);
    expect(requestPostMock).not.toHaveBeenCalled();
  });

  it("句柄缺失（ErrorNoLocalDeviceKey）→ ErrorGateDenied", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockRejectedValue(
      new ErrorNoLocalDeviceKey("no local device key: device-1"),
    );
    await expect(passGate(CHALLENGE)).rejects.toThrowError(ErrorGateDenied);
    expect(requestPostMock).not.toHaveBeenCalled();
  });

  it("验签 403 ErrorDeviceGate → ErrorGateDenied（区分于其他网络错误）", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockResolvedValue("bad-sig");
    requestPostMock.mockRejectedValue(httpGateError());

    await expect(passGate(CHALLENGE)).rejects.toThrowError(
      new ErrorGateDenied("设备验签未通过"),
    );
  });

  it("非安全上下文（无 crypto.subtle）→ ErrorGateUnavailable", async () => {
    const subtle = crypto.subtle;
    vi.stubGlobal("crypto", {});
    try {
      await expect(passGate(CHALLENGE)).rejects.toThrowError(
        ErrorGateUnavailable,
      );
    } finally {
      vi.stubGlobal("crypto", { subtle });
      vi.unstubAllGlobals();
    }
  });

  it("IndexedDB 读取失败 → ErrorGateUnavailable", async () => {
    listLocalDeviceKeysMock.mockRejectedValue(new Error("idb broken"));
    await expect(passGate(CHALLENGE)).rejects.toThrowError(
      new ErrorGateUnavailable("读取本机设备钥匙失败：idb broken"),
    );
  });

  it("verify 网络失败（非门禁拒绝）→ ErrorGateUnavailable", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockRejectedValue(new Error("network down"));

    await expect(passGate(CHALLENGE)).rejects.toThrowError(
      ErrorGateUnavailable,
    );
  });

  it("verify 响应异常（success=false / 缺 gateToken）→ ErrorGateUnavailable", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockResolvedValue({ success: false, code: 200 });

    await expect(passGate(CHALLENGE)).rejects.toThrowError(
      ErrorGateUnavailable,
    );
  });
});

describe("toGateDenial", () => {
  it("归一化门禁错误为可渲染信息", () => {
    expect(toGateDenial(new ErrorGateDenied("本机没有设备钥匙"))).toEqual({
      kind: "unauthorized",
      detail: "本机没有设备钥匙",
    });
    expect(toGateDenial(new ErrorGateUnavailable("网络错误"))).toEqual({
      kind: "unavailable",
      detail: "网络错误",
    });
    expect(toGateDenial("boom")).toEqual({
      kind: "unavailable",
      detail: "boom",
    });
  });
});
