import { requestGet, requestPost } from './base';
import {
  AppTheme,
  LoginReqData,
  LoginResp,
  PasswordConfigReqData,
  RegisterReqData,
} from '@/types/user';
import { useQuery, useMutation } from 'react-query';

/** 查询用户信息 */
export const useQueryUserInfo = (enabled: boolean) => {
  return useQuery(
    'userInfo',
    () => {
      return requestGet<LoginResp>('user/getInfo');
    },
    {
      enabled,
      // 不能缓存获取用户信息，不然用户重新登录后会使用缓存的用户信息（即错误的显示了上个用户的信息）
      cacheTime: 0,
    },
  );
};

/** 登录 */
export const useLogin = () => {
  return useMutation((data: LoginReqData) => {
    return requestPost<LoginResp>('user/login', data);
  });
};

/** 登出 */
export const useLogout = () => {
  return useMutation(() => {
    return requestPost('user/logout');
  });
};

/** 创建管理员账号 */
export const useCreateAdmin = () => {
  return useMutation((data: RegisterReqData) => {
    return requestPost('user/createAdmin', data);
  });
};

/** 注册用户 */
export const useRegister = () => {
  return useMutation((data: RegisterReqData) => {
    return requestPost('user/register', data);
  });
};

/** 统计 */
export const useQueryStatistic = () => {
  return useQuery('userStatistic', () => {
    return requestGet('user/statistic');
  });
};

/** 修改密码 */
export const useChangePassword = () => {
  return useMutation((pwdInfo: string) => {
    return requestPost('user/changePwd', { a: pwdInfo });
  });
};

/** 设置主题色 */
export const useSetTheme = () => {
  return useMutation((theme: AppTheme) => {
    return requestPost('user/setTheme', { theme });
  });
};

/** 修改密码 */
export const useResetPassword = () => {
  return useMutation((data: string) => {
    return requestPost<string>('user/changePwd', data);
  });
};

/** 设置新密码生成规则 */
export const useSetCreatePwdSetting = () => {
  return useMutation((data: PasswordConfigReqData) => {
    return requestPost('user/createPwdSetting', data);
  });
};
