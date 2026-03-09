import { useEffect, useState } from "react";
import { stateIsLoggedIn, statePasswordSalt } from "@/store/user";
import { useAtomValue, useSetAtom } from "jotai";
import { LoginPage } from "./page";
import { PageLoading } from "@/components/page-loading";
import { queryGlobal } from "@/services/auth";
import { Navigate } from "react-router-dom";
import type { LockDetail } from "@/types/auth";

const Login = () => {
  const isLoggedIn = useAtomValue(stateIsLoggedIn);
  const [checking, setChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);
  const setSalt = useSetAtom(statePasswordSalt);
  const [initialLockDetail, setInitialLockDetail] = useState<LockDetail>();

  useEffect(() => {
    const checkGlobal = async () => {
      try {
        const resp = await queryGlobal();
        if (resp.success) {
          setIsInitialized(resp.data!.isInitialized);
          if (resp.data!.salt) {
            setSalt(resp.data!.salt);
          }
          setInitialLockDetail({
            loginFailure: resp.data!.loginFailure,
            retryNumber: resp.data!.retryNumber,
            isBanned: resp.data!.isBanned,
          });
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

  return <LoginPage initialLockDetail={initialLockDetail} />;
};

export default Login;
