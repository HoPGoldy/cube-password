import { useNavigate, useSearchParams } from "react-router-dom";
import { clearGateToken } from "@/services/device-gate";

export const useLoginSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const runLoginSuccess = () => {
    // 登录成功进入应用即丢弃 gate token（内存态，仅登录走廊使用，不落 localStorage）
    clearGateToken();
    let nextUrl = searchParams.get("redirect");
    if (nextUrl) {
      nextUrl = decodeURIComponent(nextUrl);
    }

    navigate(nextUrl ? nextUrl : "/", { replace: true });
  };

  return {
    runLoginSuccess,
  };
};
