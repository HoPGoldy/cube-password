import { AppResponse } from '@/types/global';
import { logout, stateReplayAttackSecret, stateUserToken } from '@/client/store/user';
import { message } from '../utils/message';
import { createReplayAttackHeaders } from '@/utils/crypto';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { QueryClient } from 'react-query';
import { STATUS_CODE } from '@/config';
import { getDefaultStore } from 'jotai';

/**
 * 是否为标准后端数据结构
 */
const isAppResponse = (data: unknown): data is AppResponse<unknown> => {
  return typeof data === 'object' && data !== null && 'code' in data;
};

export const axiosInstance = axios.create({ baseURL: '/api/' });

axiosInstance.interceptors.request.use((config) => {
  console.log('🚀 ~ file: base.ts:21 ~ axiosInstance.interceptors.request.use ~ config:', config);
  const store = getDefaultStore();

  const token = store.get(stateUserToken);
  const replayAttackSecret = store.get(stateReplayAttackSecret);

  // 附加 jwt header
  if (token) config.headers['X-Session-Id'] = token;
  // 附加防重放攻击 header
  if (replayAttackSecret) {
    const raHeaders = createReplayAttackHeaders(
      `${config.baseURL}${config.url}`,
      replayAttackSecret,
    );
    Object.assign(config.headers, raHeaders);
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (resp) => {
    if (!isAppResponse(resp.data)) return resp;
    const { code, msg } = resp.data;

    if (code === STATUS_CODE.LOGIN_TIMEOUT) {
      logout();
    } else if (code === STATUS_CODE.BAN) {
      logout();
      message('error', msg || '您已被封禁');
    } else if (code !== STATUS_CODE.SUCCESS) {
      message('error', msg || '未知错误');
    }

    return resp;
  },
  (resp) => {
    if (!resp.response) {
      message('error', '网络错误，请检查网络连接是否正常');
      return Promise.reject(resp);
    }

    const { status, statusText, data } = resp.response;

    if (status === 413) message('error', '上传失败，文件大小超出上限');
    else message('error', statusText || data || '错误代码：' + status);

    return Promise.reject(resp);
  },
);

export const requestGet = async <T = any>(url: string, config?: AxiosRequestConfig) => {
  const resp = await axiosInstance.get<AppResponse<T>>(url, config);
  return resp.data;
};

export const requestPost = async <T = any, D = any>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig<D>,
) => {
  const resp = await axiosInstance.post<AppResponse<T>>(url, data, config);
  return resp.data;
};

export const queryClient = new QueryClient();
