import { ComponentType, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import Loading from "./layouts/loading";
import { LoginAuth } from "./layouts/login-auth";
import { AppContainer } from "./layouts/app-container";
import { Error403 } from "./pages/e403";
import Login from "./pages/login";
import Entry from "./pages/entry";
import Init from "./pages/init";

const lazyLoad = (
  compLoader: () => Promise<{ default: ComponentType<any> }>,
) => {
  const Comp = lazy(compLoader);
  return (
    <Suspense fallback={<Loading />}>
      <Comp />
    </Suspense>
  );
};

export const routes = createBrowserRouter(
  [
    {
      path: "/",
      children: [
        { index: true, element: <Entry /> },
        {
          path: "/certificates",
          element: lazyLoad(() => import("./pages/certificate-list")),
        },
        {
          path: "/search",
          element: lazyLoad(() => import("./pages/search")),
        },
        {
          path: "/settings",
          element: lazyLoad(() => import("./pages/setting")),
        },
        {
          path: "/change-password",
          element: lazyLoad(() => import("./pages/change-password")),
        },
        {
          path: "/otp-config",
          element: lazyLoad(() => import("./pages/otp-config")),
        },
        {
          path: "/security-log",
          element: lazyLoad(() => import("./pages/security-log")),
        },
        {
          path: "/about",
          element: lazyLoad(() => import("./pages/about")),
        },
      ],
      element: (
        <LoginAuth>
          <AppContainer />
        </LoginAuth>
      ),
    },
    { path: "/login", element: <Login /> },
    { path: "/init", element: <Init /> },
    { path: "/e403", element: <Error403 /> },
  ],
  {
    basename: APP_CONFIG.PATH_BASENAME,
  },
);
