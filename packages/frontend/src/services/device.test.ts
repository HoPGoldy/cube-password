import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * device services hooks 测试：mock 掉 requestPost（网络层）与 queryClient 缓存失效，
 * 用 react-query 核心（QueryClient + Mutation/QueryCache）直跑 query/mutation
 * options，验证 gate-config 读/写编排：queryKey、invalidate 联动与参数透传。
 * （无 DOM 环境、无 JSX，纯核心执行路径，与 hooks 内部实现共用同一份 options）
 */

const requestPostMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("./base", () => ({
  requestPost: (...args: unknown[]) => requestPostMock(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueriesMock(...args),
  },
}));

import {
  gateConfigQueryOptions,
  updateGateConfigMutationOptions,
} from "./device";

let queryClient: QueryClient;

beforeEach(() => {
  requestPostMock.mockReset();
  invalidateQueriesMock.mockReset();
  queryClient = new QueryClient({
    mutationCache: new MutationCache(),
    queryCache: new QueryCache(),
    defaultOptions: { queries: { retry: false } },
  });
});

describe("gateConfigQueryOptions", () => {
  it("查询键为 ['gateConfig']（update 成功后按此失效）", () => {
    expect(gateConfigQueryOptions.queryKey).toEqual(["gateConfig"]);
  });

  it("queryFn POST device/gate-config 并透传 enabled/deviceCount", async () => {
    requestPostMock.mockResolvedValue({
      success: true,
      code: 200,
      data: { enabled: false, deviceCount: 0 },
    });

    const data = await queryClient.fetchQuery({
      queryKey: gateConfigQueryOptions.queryKey,
      queryFn: gateConfigQueryOptions.queryFn,
    });

    expect(requestPostMock).toHaveBeenCalledTimes(1);
    expect(requestPostMock).toHaveBeenCalledWith("device/gate-config");
    expect(data?.data).toEqual({ enabled: false, deviceCount: 0 });
  });
});

describe("updateGateConfigMutationOptions", () => {
  it("mutationFn POST device/gate-config-update 透传 enabled", async () => {
    requestPostMock.mockResolvedValue({ success: true, code: 200, data: {} });

    const result = await queryClient
      .getMutationCache()
      .build(queryClient, updateGateConfigMutationOptions)
      .execute({ enabled: true });

    expect(result).toEqual({ success: true, code: 200, data: {} });
    expect(requestPostMock).toHaveBeenCalledWith("device/gate-config-update", {
      enabled: true,
    });
  });

  it("成功后 invalidate gateConfig 缓存（onSuccess 联动）", async () => {
    requestPostMock.mockResolvedValue({ success: true, code: 200, data: {} });

    await queryClient
      .getMutationCache()
      .build(queryClient, updateGateConfigMutationOptions)
      .execute({ enabled: false });

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["gateConfig"],
    });
  });

  it("mutation 失败（后端 400 守卫）时不 invalidate", async () => {
    requestPostMock.mockRejectedValue(new Error("400 请先绑定至少一台设备"));

    await expect(
      queryClient
        .getMutationCache()
        .build(queryClient, updateGateConfigMutationOptions)
        .execute({ enabled: true }),
    ).rejects.toThrow("请先绑定至少一台设备");

    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
