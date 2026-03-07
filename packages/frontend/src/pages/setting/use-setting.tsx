import React, { useMemo } from "react";
import {
  LockOutlined,
  SmileOutlined,
  KeyOutlined,
  FormOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { useAtomValue } from "jotai";
import { stateUser, changeTheme, logout, type AppTheme } from "@/store/user";
import { useSetTheme, useStatistic } from "@/services/user";
import { useLogout } from "@/services/auth";
import useChangePassword from "@/pages/change-password";
import useOtpConfig from "@/pages/otp-config";
import useCreatePwdSetting from "@/pages/create-pwd-setting";
import useAbout from "@/pages/about";
import useSecureLog from "@/pages/security-log";

export interface SettingLinkItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export const useSetting = () => {
  const userInfo = useAtomValue(stateUser);
  const changePassword = useChangePassword();
  const otpConfig = useOtpConfig();
  const createPwd = useCreatePwdSetting();
  const about = useAbout();
  const secureLog = useSecureLog();

  const { mutateAsync: fetchStatistic, data: statResp } = useStatistic();
  const { mutateAsync: setAppTheme } = useSetTheme();
  const { mutateAsync: postLogout, isPending: isLogouting } = useLogout();

  // Fetch statistic on first render
  useMemo(() => {
    fetchStatistic();
  }, []);

  const settingConfig = useMemo(() => {
    const list: SettingLinkItem[] = [
      {
        label: "修改密码",
        icon: <KeyOutlined />,
        onClick: changePassword.showModal,
      },
      {
        label: "动态验证码",
        icon: <LockOutlined />,
        onClick: otpConfig.showModal,
      },
      {
        label: "密码生成",
        icon: <FormOutlined />,
        onClick: createPwd.showModal,
      },
      {
        label: "安全日志",
        icon: <DatabaseOutlined />,
        onClick: secureLog.showModal,
      },
      { label: "关于", icon: <SmileOutlined />, onClick: about.showModal },
    ];
    return list;
  }, []);

  const onSwitchTheme = () => {
    const newTheme: AppTheme = userInfo?.theme === "dark" ? "light" : "dark";
    setAppTheme({ theme: newTheme });
    changeTheme(newTheme);
  };

  const onLogout = async () => {
    await postLogout();
    logout();
  };

  const groupCount = statResp?.data?.groupCount ?? "---";
  const certificateCount = statResp?.data?.certificateCount ?? "---";

  const renderModal = () => {
    return (
      <>
        {changePassword.renderModal()}
        {otpConfig.renderModal()}
        {createPwd.renderModal()}
        {about.renderModal()}
        {secureLog.renderModal()}
      </>
    );
  };

  return {
    groupCount,
    certificateCount,
    onLogout,
    isLogouting,
    settingConfig,
    userTheme: userInfo?.theme ?? "light",
    onSwitchTheme,
    renderModal,
  };
};
