import { useMutation } from "@tanstack/react-query";
import { requestPost } from "./base";
import type {
  SchemaAuthLoginBodyType,
  SchemaAuthLoginResponseType,
  SchemaAuthInitBodyType,
  SchemaAuthInitResponseType,
  SchemaAuthChangePasswordBodyType,
  SchemaChallengeResponseType,
  SchemaGlobalResponseType,
  SchemaLockDetailType,
} from "@shared-types/auth";
import type { AppResponse } from "@/types/global";

/** 登录走廊请求的公共入参：门激活时必须携带刚过门换来的临时 gate token（即取即用） */
interface GateTokenConfig {
  gateToken?: string;
}

/** 获取全局状态（是否已初始化） */
export const queryGlobal = ({ gateToken }: GateTokenConfig = {}) => {
  return requestPost<SchemaGlobalResponseType>("auth/global", undefined, {
    headers: gateToken ? { "X-Gate-Token": gateToken } : undefined,
  });
};

/** 获取 challenge code */
export const queryChallenge = ({ gateToken }: GateTokenConfig = {}) => {
  return requestPost<SchemaChallengeResponseType>("auth/challenge", undefined, {
    headers: gateToken ? { "X-Gate-Token": gateToken } : undefined,
  });
};

/** 初始化（首次设置主密码） */
export const useInit = () => {
  return useMutation({
    mutationFn: ({
      gateToken,
      ...data
    }: SchemaAuthInitBodyType & GateTokenConfig) => {
      return requestPost<SchemaAuthInitResponseType>("auth/init", data, {
        headers: gateToken ? { "X-Gate-Token": gateToken } : undefined,
      });
    },
  });
};

/** 登录响应类型（成功或失败都走这里） */
export type LoginResult = AppResponse<SchemaAuthLoginResponseType> & {
  lockDetail?: SchemaLockDetailType;
};

/** 登录 */
export const useLogin = () => {
  return useMutation({
    mutationFn: async ({
      gateToken,
      ...data
    }: SchemaAuthLoginBodyType & GateTokenConfig): Promise<LoginResult> => {
      try {
        return await requestPost<SchemaAuthLoginResponseType>(
          "auth/login",
          data,
          {
            headers: gateToken ? { "X-Gate-Token": gateToken } : undefined,
          },
        );
      } catch (err: any) {
        // 登录失败时从 axios error 中提取响应数据
        const respData = err?.response?.data;
        if (respData) {
          return {
            ...respData,
            lockDetail: respData.data,
          } as LoginResult;
        }
        throw err;
      }
    },
  });
};

/** 登出 */
export const useLogout = () => {
  return useMutation({
    mutationFn: () => {
      return requestPost("auth/logout");
    },
  });
};

/** 修改密码 */
export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: SchemaAuthChangePasswordBodyType) => {
      return requestPost("auth/change-password", data);
    },
  });
};
