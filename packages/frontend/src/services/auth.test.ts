import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * querySessionChallenge 回归测试（线上事故：设备门开启后改密码流程里
 * 裸调预登录路由 /auth/challenge 被 403 ErrorDeviceGate 拦截，弹窗静默
 * 失败、密码未改，用户误以为改密成功）。修复方案：会话内流程改走
 * session 保护的 /auth/session-challenge。mock 掉 requestPost，验证：
 * ① 请求打到 session-challenge 端点；② 无 body、无自定义 headers
 * （requestPost 自动携带 X-Session-Token，无需 gate token）；③ 成功
 * 响应原样透传。
 */

const requestPostMock = vi.fn();
vi.mock("./base", () => ({
  requestPost: (...args: unknown[]) => requestPostMock(...args),
}));

import { querySessionChallenge } from "./auth";

beforeEach(() => {
  requestPostMock.mockReset();
});

describe("querySessionChallenge", () => {
  it("请求 /auth/session-challenge，无 body、无自定义 headers（session 自动携带）", async () => {
    requestPostMock.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: { code: "challenge-abc" },
    });

    const resp = await querySessionChallenge();

    expect(resp.data).toEqual({ code: "challenge-abc" });
    expect(requestPostMock).toHaveBeenCalledTimes(1);
    // 仅端点参数：无 body、无自定义 headers（session 由拦截器自动携带）
    expect(requestPostMock).toHaveBeenCalledWith("auth/session-challenge");
  });

  it("失败响应原样透传给调用方处理", async () => {
    requestPostMock.mockResolvedValueOnce({
      success: false,
      code: 40102,
      message: "未授权访问",
    });

    const resp = await querySessionChallenge();

    expect(resp.success).toBe(false);
    expect(resp.message).toBe("未授权访问");
  });
});
