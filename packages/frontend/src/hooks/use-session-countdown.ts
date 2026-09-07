/**
 * 会话倒计时（mm:ss）格式化。
 * 剩余毫秒截断到秒（1.9s → 00:01，不会虚高显示 00:02）。
 */
export const formatSessionCountdown = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/**
 * 计算当前剩余时间。
 * @param expiresAt 服务端 login 响应下发的绝对过期时刻（ISO 字符串）
 * @param now 当前时刻；默认取本地时钟。注意：两端时钟偏差会 1:1 体现在
 *            剩余时间上（本机慢 → 显示偏长）；真实过期判定以服务端 401 为准，
 *            倒计时仅是提示 UI。
 */
export const getSessionRemainingMs = (
  expiresAt: string,
  now: number = Date.now(),
): number => new Date(expiresAt).getTime() - now;

/**
 * 倒计时是否处于警示状态（最后 1 分钟）。
 */
export const isSessionCountdownWarning = (remainingMs: number): boolean =>
  remainingMs <= 60_000;
