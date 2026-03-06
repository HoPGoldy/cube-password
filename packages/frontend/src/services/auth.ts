import { useMutation } from "@tanstack/react-query";
import { requestGet, requestPost } from "./base";
import type {
  SchemaAuthLoginBodyType,
  SchemaAuthLoginResponseType,
  SchemaAuthInitBodyType,
  SchemaAuthInitResponseType,
  SchemaAuthChangePasswordBodyType,
  SchemaChallengeResponseType,
  SchemaGlobalResponseType,
} from "@shared-types/auth";

/** 获取全局状态（是否已初始化） */
export const queryGlobal = () => {
  return requestGet<SchemaGlobalResponseType>("auth/global");
};

/** 获取 challenge code */
export const queryChallenge = () => {
  return requestGet<SchemaChallengeResponseType>("auth/challenge");
};

/** 初始化（首次设置主密码） */
export const useInit = () => {
  return useMutation({
    mutationFn: (data: SchemaAuthInitBodyType) => {
      return requestPost<SchemaAuthInitResponseType>("auth/init", data);
    },
  });
};

/** 登录 */
export const useLogin = () => {
  return useMutation({
    mutationFn: (data: SchemaAuthLoginBodyType) => {
      return requestPost<SchemaAuthLoginResponseType>("auth/login", data);
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
