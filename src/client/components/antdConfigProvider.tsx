import React, { FC, PropsWithChildren, useEffect, useMemo } from 'react';
import { ConfigProvider, ThemeConfig, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import cloneDeep from 'lodash/cloneDeep';
import { useIsMobile } from '../layouts/responsive';
import { getUserTheme, stateUser } from '../store/user';
import { AppTheme } from '@/types/user';
import { useAtomValue } from 'jotai';
import { stateAppConfig } from '../store/global';
import { SmileOutlined } from '@ant-design/icons';

const globalThemeConfig: ThemeConfig = {
  // algorithm: theme.darkAlgorithm,
  token: {
    lineWidth: 2,
    controlOutlineWidth: 1,
  },
  components: {
    Card: {
      colorBorderSecondary: 'var(--color-border-secondary)',
      lineHeight: 1.6,
    },
  },
};

const customizeRenderEmpty = () => (
  <div style={{ textAlign: 'center' }}>
    <SmileOutlined style={{ fontSize: 20 }} />
    <p>Data Not Found</p>
  </div>
);

/**
 * antd 使用的主题配置
 */
export const AntdConfigProvider: FC<PropsWithChildren> = (props) => {
  const appConfig = useAtomValue(stateAppConfig);
  const userInfo = useAtomValue(stateUser);
  const isMobile = useIsMobile();

  const themeConfig: ThemeConfig = useMemo(() => {
    const theme = cloneDeep(globalThemeConfig);
    if (appConfig?.buttonColor) {
      document.documentElement.style.setProperty(
        '--cube-password-primary-button-color',
        appConfig.buttonColor,
      );
    }

    if (theme.token) {
      if (appConfig?.primaryColor) theme.token.colorPrimary = appConfig.primaryColor;
      if (isMobile) theme.token.fontSize = 16;
    }

    const userTheme = getUserTheme(userInfo?.theme);
    if (userTheme === AppTheme.Dark) {
      theme.algorithm = antdTheme.darkAlgorithm;
    }

    return theme;
  }, [appConfig, userInfo?.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', getUserTheme(userInfo?.theme));
  }, [userInfo?.theme]);

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig} renderEmpty={customizeRenderEmpty}>
      {props.children}
    </ConfigProvider>
  );
};
