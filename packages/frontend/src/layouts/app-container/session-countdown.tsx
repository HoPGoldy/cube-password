import { useSyncExternalStore } from "react";
import { Tooltip } from "antd";
import { useAtomValue } from "jotai";
import {
  getSessionRemainingMs,
  formatSessionCountdown,
  isSessionCountdownWarning,
} from "@/hooks/use-session-countdown";
import { stateSessionExpiresAt } from "@/store/user";

/** 1s tick 的极简外部存储：所有订阅者共享一个 interval */
const createTickStore = (intervalMs: number) => {
  const listeners = new Set<() => void>();
  let snapshot = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!timer) {
        timer = setInterval(() => {
          snapshot += 1;
          listeners.forEach((l) => l());
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
          snapshot = 0;
        }
      };
    },
    getSnapshot: () => snapshot,
  };
};

const tickStore = createTickStore(1000);

/**
 * 右上角会话倒计时（mm:ss）。
 * - 时间基准为服务端 login 响应的 expiresAt，本地时钟偏差不影响正确性
 * - 最后 1 分钟变警示色；归零后停留在 00:00，等待下一次请求的 401 拦截器弹回登录页
 * - 通过 CubeApp 的 headerRight 插槽渲染（移动端 shell 无 header，不渲染）
 */
export const SessionCountdown = () => {
  const expiresAt = useAtomValue(stateSessionExpiresAt);
  useSyncExternalStore(
    tickStore.subscribe,
    tickStore.getSnapshot,
    () => 0, // server snapshot
  );

  if (!expiresAt) return null;

  const remainingMs = getSessionRemainingMs(expiresAt);
  const warning = isSessionCountdownWarning(remainingMs);

  return (
    <Tooltip
      title={
        remainingMs > 0
          ? "会话剩余时间，倒计时结束后将会自动退出登录"
          : "会话已过期，请重新登录"
      }
    >
      <span
        className={`mr-3 select-none font-mono text-sm tabular-nums ${
          warning ? "text-red-500" : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        {formatSessionCountdown(remainingMs)}
        {remainingMs <= 0 ? "（已过期）" : ""}
      </span>
    </Tooltip>
  );
};
