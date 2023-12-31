import { STATUS_CODE } from '@/config';
import { LoginSuccessResp } from '@/types/user';
import React, { FC, useEffect, PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryUserInfo } from '../services/user';
import { login, stateUser, stateUserToken } from '../store/user';
import Loading from './loading';
import { useAtomValue } from 'jotai';

export const LoginAuth: FC<PropsWithChildren> = ({ children }) => {
  const userInfo = useAtomValue(stateUser);
  const token = useAtomValue(stateUserToken);
  const { data: userInfoResp } = useQueryUserInfo(!!(token && !userInfo));

  useEffect(() => {
    if (!userInfoResp || userInfoResp.code !== STATUS_CODE.SUCCESS) return;
    const userInfo = userInfoResp.data as LoginSuccessResp;
    login(userInfo);
  }, [userInfoResp]);

  if ((!userInfo && !token) || userInfoResp?.code === STATUS_CODE.LOGIN_TIMEOUT) {
    return <Navigate to='/login' replace />;
  }

  if (!userInfo && token) {
    return <Loading tip='正在加载用户信息...' className='mt-24' />;
  }

  return <>{children}</>;
};
