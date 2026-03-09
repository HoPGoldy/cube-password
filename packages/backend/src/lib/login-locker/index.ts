import dayjs from "dayjs";

const MAX_FAIL_COUNT = 3;

export interface LoginFailRecord {
  ip: string;
  date: number;
  location: string;
}

export interface LockDetail {
  loginFailure: LoginFailRecord[];
  retryNumber: number;
  isBanned: boolean;
}

export class LoginLocker {
  private failRecords: LoginFailRecord[] = [];

  recordLoginFail(ip: string, location: string): LockDetail {
    this.failRecords.push({ ip, date: Date.now(), location });
    return this.getLockDetail();
  }

  isLocked(ip: string): boolean {
    return this.getFailCount(ip) >= MAX_FAIL_COUNT;
  }

  getFailCount(ip: string): number {
    this.cleanup();
    return this.failRecords.filter(
      (r) => r.ip === ip && dayjs(r.date).isSame(dayjs(), "day"),
    ).length;
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
    const today = dayjs();
    this.failRecords = this.failRecords.filter((r) =>
      dayjs(r.date).isSame(today, "day"),
    );
  }
}
