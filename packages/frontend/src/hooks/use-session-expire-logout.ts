import { useEffect } from "react";
import { getSessionRemainingMs } from "./use-session-countdown";

/**
 * 会话绝对超时到达后触发登出。挂在已登录布局上，不依赖倒计时 UI 是否渲染
 * （移动端 shell 无 header，倒计时组件不会挂载）。
 */
export const useSessionExpireLogout = (
  expiresAt: string | undefined,
  onExpire: () => void,
) => {
  useEffect(() => {
    if (!expiresAt) return;
    const remainingMs = getSessionRemainingMs(expiresAt);
    if (remainingMs <= 0) {
      onExpire();
      return;
    }
    const timer = window.setTimeout(onExpire, remainingMs);
    return () => window.clearTimeout(timer);
  }, [expiresAt, onExpire]);
};
