import React, { useMemo } from 'react';
import { AppTheme } from '@/types/user';
import { changeTheme, getUserTheme, logout, stateUser } from '@/client/store/user';
import { useLogout, useQueryStatistic, useSetTheme } from '@/client/services/user';
import { LockOutlined, SmileOutlined } from '@ant-design/icons';
import { useAtomValue } from 'jotai';
import useOtpConfig from '../otpConfig';
import useChangePassword from '../changePassword';
import useCreatePwdSetting from '../createPwdSetting';
import useAbout from '../about';

export interface SettingLinkItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export const useSetting = () => {
  const userInfo = useAtomValue(stateUser);
  /** 修改密码功能 */
  const changePassword = useChangePassword();
  /** otp 验证码配置 */
  const optConfig = useOtpConfig();
  /** 新密码生成规则 */
  const createPwd = useCreatePwdSetting();
  /** 关于页面 */
  const about = useAbout();
  // 数量统计接口
  const { data: countInfo } = useQueryStatistic();
  /** 主题设置 */
  const { mutateAsync: setAppTheme } = useSetTheme();
  /** 登出接口 */
  const { mutateAsync: postLogout, isLoading: isLogouting } = useLogout();

  const settingConfig = useMemo(() => {
    const list: SettingLinkItem[] = [
      {
        label: '修改密码',
        icon: <LockOutlined />,
        onClick: changePassword.showModal,
      },
      { label: '动态验证码', icon: <LockOutlined />, onClick: optConfig.showModal },
      { label: '密码生成', icon: <LockOutlined />, onClick: createPwd.showModal },
      {
        label: '关于',
        icon: <SmileOutlined />,
        onClick: about.showModal,
      },
    ].filter(Boolean);

    return list;
  }, []);

  const onSwitchTheme = () => {
    const newTheme = userInfo?.theme === AppTheme.Light ? AppTheme.Dark : AppTheme.Light;
    setAppTheme(newTheme);
    changeTheme(newTheme);
  };

  const onLogout = async () => {
    await postLogout();
    logout();
  };

  const groupCount = countInfo?.data?.groupCount || '---';
  const certificateCount = countInfo?.data?.certificateCount || '---';
  const userTheme = getUserTheme(userInfo?.theme);

  const renderModal = () => {
    return (
      <>
        {changePassword.renderModal()}
        {optConfig.renderModal()}
        {createPwd.renderModal()}
        {about.renderModal()}
      </>
    );
  };

  return {
    groupCount,
    certificateCount,
    onLogout,
    isLogouting,
    settingConfig,
    userTheme,
    onSwitchTheme,
    renderModal,
  };
};
