import React from "react";
import { Outlet } from "react-router-dom";

export const AppContainer: React.FC = () => {
  return (
    <main className="h-full w-full">
      <Outlet />
    </main>
  );
};
