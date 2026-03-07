import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../sidebar";
import { useIsMobile } from "../responsive";
import Header from "../header";

const SIDE_WIDTH = "240px";

export const AppContainer: React.FC = () => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);

  if (isMobile) {
    return (
      <main className="h-full w-screen">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="h-full flex">
      <aside
        className="overflow-hidden transition-[width] flex-shrink-0"
        style={{ width: collapsed ? 0 : SIDE_WIDTH }}
      >
        <Sidebar />
      </aside>
      <div
        className="flex-grow overflow-hidden transition-[width]"
        style={{ width: collapsed ? "100vw" : `calc(100vw - ${SIDE_WIDTH})` }}
      >
        <Header
          onClickCollapsedIcon={() => setCollapsed(!collapsed)}
          collapsed={collapsed}
        />

        {/* 后面减去的 1px 是标题栏底部边框的高度 */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ height: "calc(100% - 3rem - 1px)" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
