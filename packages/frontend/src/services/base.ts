import { AppResponse } from "@/types/global";
import { logout, stateSessionToken } from "@/store/user";
import {
  clearGateToken,
  getValidGateToken,
  GATE_CORRIDOR_URLS,
  ERROR_CODE_DEVICE_GATE,
} from "./device-gate";
import { showGlobalMessage } from "../utils/message";
import { mergeUrl } from "../utils/path";
import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";

/**
 * 是否为标准后端数据结构
 */
const isAppResponse = (data: unknown): data is AppResponse<unknown> => {
  return typeof data === "object" && data !== null && "code" in data;
};

export const axiosInstance = axios.create({ baseURL: "api/" });

axiosInstance.interceptors.request.use((config) => {
  const store = getDefaultStore();
  const token = store.get(stateSessionToken);

  // 附加 session token header
  if (token) config.headers["X-Session-Token"] = token;

  // 登录走廊期间的请求附带设备门禁令牌（有值时；门未激活时恒为空）
  if (config.url && GATE_CORRIDOR_URLS.has(config.url)) {
    const gateToken = getValidGateToken();
    if (gateToken) config.headers["X-Gate-Token"] = gateToken;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (resp) => {
    if (!isAppResponse(resp.data)) return resp;
    const { code, message: msg } = resp.data;

    if (code !== 200 && msg) {
      showGlobalMessage("warning", msg);
    }

    return resp;
  },
  (resp) => {
    if (!resp.response) {
      showGlobalMessage("error", "网络错误，请检查网络连接是否正常");
      return Promise.reject(resp);
    }

    const { status, data, config } = resp.response;
    const isLoginRequest = config?.url === "auth/login";

    if (status === 413) {
      showGlobalMessage("error", "上传失败，文件大小超出上限");
      return Promise.reject(resp);
    }

    // 登录请求的错误直接透传给调用方，不做拦截处理
    if (isLoginRequest) {
      return Promise.reject(resp);
    }

    // 设备门拒绝（ErrorDeviceGate）：令牌可能已过期或被服务端重置，清空内存令牌。
    // 门页（login/init）上：探针/过门请求由页面编排捕获渲染未授权页；但表单发起的
    // 走廊请求（auth/challenge、auth/init）在 token 过期后也会收到 40301，表单代码
    // 没有对应 catch —— 这里提示并自愈刷新（重跑完整门禁流程），避免零反馈死操作。
    // 非门页收到门禁拒绝意味着“会话建立后门才被激活”等罕见场景，跳登录重跑门禁。
    if (status === 403 && data?.code === ERROR_CODE_DEVICE_GATE) {
      clearGateToken();
      // 门禁编排自身的端点（device/challenge|verify）拒绝必须透传：
      // 页面的 probeGate/passGate 编排靠 catch 渲染未授权页——若在这里 reload，
      // 吊销钥匙/未录入钥匙的设备会无限重载（通往未授权页的必经请求就是 40301）
      const isGateOrchestration =
        config?.url === "device/challenge" || config?.url === "device/verify";
      const onGatePage =
        window.location.pathname.includes("/login") ||
        window.location.pathname.includes("/init");
      if (onGatePage && !isGateOrchestration) {
        // 表单发起的走廊请求（auth/challenge 等）token 过期：表单代码无对应
        // catch，自愈刷新重跑完整门禁流程
        showGlobalMessage("warning", "门禁验证已过期，正在重新验证…");
        window.location.reload();
      } else if (!onGatePage) {
        window.location.href = mergeUrl(APP_CONFIG.PATH_BASENAME, "login");
      }
      return Promise.reject(resp);
    }

    if (status === 403 && data?.code !== ERROR_CODE_DEVICE_GATE) {
      window.location.href = mergeUrl(APP_CONFIG.PATH_BASENAME, "e403");
      return Promise.reject(resp);
    }

    if (status === 401) {
      clearGateToken();
      logout();
    }

    if (data?.message) {
      showGlobalMessage("warning", data.message);
    }

    return Promise.reject(resp);
  },
);

export const requestPost = async <T = any, D = any>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig<D>,
) => {
  const resp = await axiosInstance.post<AppResponse<T>>(url, data, config);
  return resp.data;
};

export const queryClient = new QueryClient();
