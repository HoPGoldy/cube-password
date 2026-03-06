import { FC, PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { stateIsLoggedIn } from "../store/user";
import { useAtomValue } from "jotai";

export const LoginAuth: FC<PropsWithChildren> = ({ children }) => {
  const isLoggedIn = useAtomValue(stateIsLoggedIn);

  if (!isLoggedIn) {
    return <Navigate to={`/login`} replace />;
  }

  return <>{children}</>;
};
