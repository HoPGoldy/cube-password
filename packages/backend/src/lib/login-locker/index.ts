const MAX_FAIL_COUNT = 3;

/** 本地时区下「自然日」的时间戳（跨天清零失败计数用），避免为一次同日判断引入 dayjs */
const localDayKey = (ts: number) => new Date(ts).toDateString();

export interface LoginFailRecord {
  date: number;
}

export interface LockDetail {
  loginFailure: LoginFailRecord[];
  retryNumber: number;
  isBanned: boolean;
}

export class LoginLocker {
  private failRecords: LoginFailRecord[] = [];

  recordLoginFail(): LockDetail {
    this.failRecords.push({ date: Date.now() });
    return this.getLockDetail();
  }

  /** 登录成功后清零失败计数：只有密码验证通过（已证明身份）才可触达 */
  reset(): void {
    this.failRecords = [];
  }

  isLocked(): boolean {
    return this.getFailCount() >= MAX_FAIL_COUNT;
  }

  getFailCount(): number {
    this.cleanup();
    return this.failRecords.length;
  }

  getLockDetail(): LockDetail {
    this.cleanup();
    return {
      loginFailure: this.failRecords,
      retryNumber: Math.max(0, MAX_FAIL_COUNT - this.failRecords.length),
      isBanned: this.failRecords.length >= MAX_FAIL_COUNT,
    };
  }

  private cleanup(): void {
    const today = localDayKey(Date.now());
    this.failRecords = this.failRecords.filter(
      (r) => localDayKey(r.date) === today,
    );
  }
}
