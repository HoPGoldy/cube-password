import { useEffect, useState } from "react";
import { login, stateIsLoggedIn, statePasswordSalt } from "@/store/user";
import { useAtomValue, useSetAtom } from "jotai";
import { LoginPage } from "./page";
import { PageLoading } from "@/components/page-loading";
import { queryGlobal } from "@/services/auth";
import { useLoginSuccess } from "./use-login-success";
import { Navigate } from "react-router-dom";

const Login = () => {
  const isLoggedIn = useAtomValue(stateIsLoggedIn);
  const [checking, setChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);
  const setSalt = useSetAtom(statePasswordSalt);

  useEffect(() => {
    const checkGlobal = async () => {
      try {
        const resp = await queryGlobal();
        if (resp.success) {
          setIsInitialized(resp.data!.isInitialized);
          if (resp.data!.salt) {
            setSalt(resp.data!.salt);
          }
        }
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    };
    checkGlobal();
  }, []);

  if (checking) return <PageLoading />;

  if (!isInitialized) {
    return <Navigate to="/init" replace />;
  }

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
};

export default Login;
