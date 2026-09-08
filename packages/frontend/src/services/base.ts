import { AppResponse } from "@/types/global";
import { logout, stateSessionToken } from "@/store/user";
import { ERROR_CODE_DEVICE_GATE } from "./device-gate";
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

    // 设备门拒绝（ErrorDeviceGate，40301）：在新设计下只可能意味着钥匙被拒 /
    // 门态突变（token 即取即用，不存在客户端侧过期）。
    // 门页（login/init）上：由页面流程 catch 渲染未授权页，这里不做任何事直接
    // reject 透传；非门页意味着“会话建立后门才被激活”等罕见场景，跳登录重跑门禁。
    if (status === 403 && data?.code === ERROR_CODE_DEVICE_GATE) {
      const onGatePage =
        window.location.pathname.includes("/login") ||
        window.location.pathname.includes("/init");
      if (!onGatePage) {
        window.location.href = mergeUrl(APP_CONFIG.PATH_BASENAME, "login");
      }
      return Promise.reject(resp);
    }

    if (status === 403 && data?.code !== ERROR_CODE_DEVICE_GATE) {
      window.location.href = mergeUrl(APP_CONFIG.PATH_BASENAME, "e403");
      return Promise.reject(resp);
    }

    if (status === 401) {
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
