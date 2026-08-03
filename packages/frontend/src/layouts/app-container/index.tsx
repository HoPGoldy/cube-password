import { useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Switch } from "antd";
import {
  CubeApp,
  type AccountMenuItem,
  type AccountMenuStat,
} from "@hopgoldy/cube-ui";
import {
  KeyOutlined,
  LockOutlined,
  FormOutlined,
  DatabaseOutlined,
  SnippetsOutlined,
  HighlightOutlined,
} from "@ant-design/icons";
import { useAtomValue } from "jotai";
import { Sidebar } from "../sidebar";
import { useHeaderPageTitle } from "./use-page-title";
import { THEME_PRIMARY_COLOR } from "@/config";
import { stateUser, changeTheme, logout, type AppTheme } from "@/store/user";
import { useSetTheme, useStatistic } from "@/services/user";
import { useLogout } from "@/services/auth";
import { useAppVersion } from "@/services/app-config";
import useChangePassword from "@/pages/change-password";
import useOtpConfig from "@/pages/otp-config";
import useCreatePwdSetting from "@/pages/create-pwd-setting";
import useSecureLog from "@/pages/security-log";

export const AppContainer = () => {
  const navigate = useNavigate();
  const renderTitle = useHeaderPageTitle();
  const userInfo = useAtomValue(stateUser);

  const changePassword = useChangePassword();
  const otpConfig = useOtpConfig();
  const createPwd = useCreatePwdSetting();
  const secureLog = useSecureLog();

  const { mutateAsync: fetchStatistic, data: statResp } = useStatistic();
  const { mutateAsync: setAppTheme } = useSetTheme();
  const { mutateAsync: postLogout } = useLogout();
  const { appVersion } = useAppVersion();

  // 首次渲染时拉取统计信息
  useMemo(() => {
    fetchStatistic();
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

  const accountMenuStats: AccountMenuStat[] = [
    {
      key: "group",
      title: "分组数量",
      value: statResp?.data?.groupCount ?? "---",
      icon: <SnippetsOutlined />,
    },
    {
      key: "certificate",
      title: "凭证数量",
      value: statResp?.data?.certificateCount ?? "---",
      icon: <HighlightOutlined />,
    },
  ];

  const accountMenuItems: AccountMenuItem[] = [
    {
      key: "change-password",
      label: "修改密码",
      icon: <KeyOutlined />,
      onClick: changePassword.showModal,
    },
    {
      key: "otp-config",
      label: "动态验证码",
      icon: <LockOutlined />,
      onClick: otpConfig.showModal,
    },
    {
      key: "create-pwd",
      label: "密码生成",
      icon: <FormOutlined />,
      onClick: createPwd.showModal,
    },
    {
      key: "security-log",
      label: "安全日志",
      icon: <DatabaseOutlined />,
      onClick: secureLog.showModal,
    },
    {
      key: "theme",
      // 点击按钮或 Switch 都会触发 onClick 切换主题
      label: (
        <span className="flex justify-between items-center w-full">
          黑夜模式
          <Switch size="small" checked={userInfo?.theme === "dark"} />
        </span>
      ),
      onClick: onSwitchTheme,
    },
  ];

  return (
    <CubeApp
      primaryColor={THEME_PRIMARY_COLOR}
      sidebarList={<Sidebar />}
      headerLeft={renderTitle()}
      onHeaderSearchBtnClick={() => navigate("/search")}
      accountMenuStats={accountMenuStats}
      accountMenuItems={accountMenuItems}
      onLogoutBtnClick={onLogout}
      about={{
        name: appVersion?.name ?? "",
        version: appVersion?.version,
        repository: appVersion?.repository,
        description: (
          <>
            安全可靠的自托管密码管理器。
            <br />
            <br />
            支持分组管理、动态验证码、双端响应式布局、数据自托管等功能。
          </>
        ),
        contactEmail: "hopgoldy@gmail.com",
        author: { name: "Yuzizi" },
      }}
    >
      <Outlet />
      {changePassword.renderModal()}
      {otpConfig.renderModal()}
      {createPwd.renderModal()}
      {secureLog.renderModal()}
    </CubeApp>
  );
};
