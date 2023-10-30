import React, { ComponentType, lazy, Suspense } from 'react';
import { createHashRouter, Outlet } from 'react-router-dom';
import Loading from './layouts/loading';
import { LoginAuth } from './layouts/loginAuth';
import { AppContainer } from './layouts/appContainer';
import Search from './pages/search';
import Entry from './pages/jumpToDefaultDataEntry';
import { AppConfigProvider } from './layouts/appConfigProvider';
import CertificateList from './pages/certificateList';

const lazyLoad = (compLoader: () => Promise<{ default: ComponentType<any> }>) => {
  const Comp = lazy(compLoader);
  return (
    <Suspense fallback={<Loading />}>
      <Comp />
    </Suspense>
  );
};

export const routes = createHashRouter([
  {
    path: '/',
    children: [
      {
        path: '/',
        children: [
          { index: true, element: <Entry /> },
          // 凭证列表
          { path: '/group/:groupId', element: <CertificateList /> },
          // 搜索
          { path: '/search', element: <Search /> },
        ],
        element: (
          <LoginAuth>
            <AppContainer />
          </LoginAuth>
        ),
      },
      // 登录
      { path: '/login', element: lazyLoad(() => import('./pages/login')) },
      // 初始化管理员
      { path: '/init', element: lazyLoad(() => import('./pages/createAdmin')) },
    ],
    element: (
      <AppConfigProvider>
        <Outlet />
      </AppConfigProvider>
    ),
  },
]);
