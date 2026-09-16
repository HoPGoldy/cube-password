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
  isDeviceGateRejection,
  passGate,
  toGateDenial,
  withGateToken,
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

const CHALLENGE = "challenge-abc";

beforeEach(() => {
  requestPostMock.mockReset();
  listLocalDeviceKeysMock.mockReset();
  silentVerifyMock.mockReset();
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

describe("withGateToken", () => {
  const passGateHappyPath = () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKeyTemplate("device-1")]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockImplementation(async (url: string) => {
      if (url === "device/challenge") {
        return {
          success: true,
          code: 200,
          data: { challenge: CHALLENGE, gateEnabled: true },
        };
      }
      return { success: true, code: 200, data: { gateToken: "gate-token-1" } };
    });
  };

  const localKeyTemplate = (deviceId?: string) => ({
    deviceId,
    name: "Chrome on macOS",
    publicKey: "MFkw...==",
    createdAt: "2026-01-01T00:00:00.000Z",
    privateKey: {} as CryptoKey,
  });

  it("跑一遍过门并把 token 传给 fn，返回 fn 结果", async () => {
    passGateHappyPath();
    const fn = vi.fn(async (token: string | undefined) => ({ used: token }));

    const result = await withGateToken(fn);

    expect(result).toEqual({ used: "gate-token-1" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("gate-token-1");
    // 完整过门三步：探针拿挑战码 → verify 换 token
    expect(requestPostMock).toHaveBeenNthCalledWith(1, "device/challenge");
    expect(requestPostMock).toHaveBeenNthCalledWith(2, "device/verify", {
      challenge: CHALLENGE,
      signature: "sig",
    });
  });

  it("fn 内部错误原样上抛，不被包装成门禁错误", async () => {
    passGateHappyPath();
    const boom = new Error("fn boom");

    await expect(withGateToken(() => Promise.reject(boom))).rejects.toThrow(
      boom,
    );
  });

  it("过门失败（ErrorGateDenied）时 fn 不被调用", async () => {
    requestPostMock.mockImplementation(async (url: string) => {
      if (url === "device/challenge") {
        return {
          success: true,
          code: 200,
          data: { challenge: CHALLENGE, gateEnabled: true },
        };
      }
      throw httpGateError();
    });
    listLocalDeviceKeysMock.mockResolvedValue([localKeyTemplate("device-1")]);
    silentVerifyMock.mockResolvedValue("bad-sig");
    const fn = vi.fn();

    await expect(withGateToken(fn)).rejects.toThrowError(ErrorGateDenied);
    expect(fn).not.toHaveBeenCalled();
  });

  it("探针失败（success=false）→ ErrorGateUnavailable，fn 不被调用", async () => {
    requestPostMock.mockResolvedValue({ success: false, code: 500 });
    const fn = vi.fn();

    await expect(withGateToken(fn)).rejects.toThrowError(ErrorGateUnavailable);
    expect(fn).not.toHaveBeenCalled();
  });

  it("门未激活时直接以 undefined 调 fn，不发起过门请求", async () => {
    requestPostMock.mockImplementation(async (url: string) => {
      if (url === "device/challenge") {
        return {
          success: true,
          code: 200,
          data: { challenge: CHALLENGE, gateEnabled: false },
        };
      }
      return { success: true, code: 200, data: {} };
    });
    const fn = vi.fn(async (token: string | undefined) => ({ used: token }));

    const result = await withGateToken(fn);

    expect(result).toEqual({ used: undefined });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(undefined);
    // 只有探针请求，无 verify（纯密码模式不需要 token）
    expect(requestPostMock).toHaveBeenCalledTimes(1);
    expect(requestPostMock).toHaveBeenCalledWith("device/challenge");
  });

  it("token 不逃逸出调用栈：模块级无状态可残留（重复调用各自现取）", async () => {
    passGateHappyPath();

    const first = await withGateToken(async (token) => token);
    const second = await withGateToken(async (token) => token);

    // 两次调用各自走完整过门流程，各拿各的 token，无跨调用共享
    expect(first).toBe("gate-token-1");
    expect(second).toBe("gate-token-1");
    expect(requestPostMock).toHaveBeenCalledTimes(4);
  });
});

describe("passGate", () => {
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
      challenge: CHALLENGE,
      signature: "sig-bytes",
    });
  });

  it("多钥匙逐把尝试：第一把被拒后换下一把并重新取挑战码", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([
      localKey("device-revoked"),
      localKey("device-2"),
    ]);
    silentVerifyMock.mockResolvedValue("sig");
    // 第一把被服务端拒（模拟已吊销设备），第二把过
    // 调用序列（Once 队列按注册顺序消费）：
    //   verify#1 403 拒（模拟已吊销设备）→ challenge 探针 → verify#2 过
    requestPostMock
      .mockRejectedValueOnce(
        Object.assign(new Error("403"), {
          response: { status: 403, data: { code: 40301 } },
        }),
      )
      .mockImplementationOnce(async () => ({
        success: true,
        code: 200,
        data: { challenge: "challenge-2" },
      }))
      .mockResolvedValueOnce({
        success: true,
        code: 200,
        data: { gateToken: "t2" },
      });

    const { gateToken } = await passGate(CHALLENGE);
    expect(gateToken).toBe("t2");
    expect(silentVerifyMock).toHaveBeenCalledWith("device-2", "challenge-2");
  });

  it("pending 槽位记录（无 deviceId）也能参与逐把尝试", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey(undefined)]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockResolvedValue({
      success: true,
      code: 200,
      data: { gateToken: "t" },
    });

    await passGate(CHALLENGE);

    expect(requestPostMock).toHaveBeenCalledWith("device/verify", {
      challenge: CHALLENGE,
      signature: "sig",
    });
  });

  it("本机无任何钥匙 → ErrorGateDenied", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([]);
    await expect(passGate(CHALLENGE)).rejects.toThrowError(ErrorGateDenied);
    expect(requestPostMock).not.toHaveBeenCalled();
  });

  it("句柄缺失（ErrorNoLocalDeviceKey）且无其他钥匙 → ErrorGateDenied", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockRejectedValue(
      new ErrorNoLocalDeviceKey("no local device key: device-1"),
    );
    await expect(passGate(CHALLENGE)).rejects.toThrowError(ErrorGateDenied);
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

  it("verify 网络失败（非门禁拒绝）→ 原样上抛，不换钥匙重试", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockRejectedValue(new Error("network down"));

    await expect(passGate(CHALLENGE)).rejects.toThrowError("network down");
  });

  it("verify 响应异常（success=false）→ 全部尝试后 ErrorGateDenied", async () => {
    listLocalDeviceKeysMock.mockResolvedValue([localKey("device-1")]);
    silentVerifyMock.mockResolvedValue("sig");
    requestPostMock.mockResolvedValue({ success: false, code: 200 });

    await expect(passGate(CHALLENGE)).rejects.toThrowError(ErrorGateDenied);
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
