import { ComponentType, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import Loading from "./layouts/loading";
import { LoginAuth } from "./layouts/login-auth";
import { AppContainer } from "./layouts/app-container";
import { Error403 } from "./pages/e403";
import Login from "./pages/login";
import Entry from "./pages/entry";
import Search from "./pages/search/search";

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
        { path: "/search", element: <Search /> },
      ],
      element: (
        <LoginAuth>
          <AppContainer />
        </LoginAuth>
      ),
    },
    // 登录
    {
      path: "/login",
      element: <Login />,
    },
    { path: "/e403", element: <Error403 /> },
  ],
  {
    basename: APP_CONFIG.PATH_BASENAME,
  },
);
