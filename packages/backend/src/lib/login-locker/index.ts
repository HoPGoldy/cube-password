import dayjs from "dayjs";

const MAX_FAIL_COUNT = 3;

interface LoginFailRecord {
  ip: string;
  date: number;
}

export class LoginLocker {
  private failRecords: LoginFailRecord[] = [];

  recordLoginFail(ip: string): void {
    this.failRecords.push({ ip, date: Date.now() });
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

  private cleanup(): void {
    const today = dayjs();
    this.failRecords = this.failRecords.filter((r) =>
      dayjs(r.date).isSame(today, "day"),
    );
  }
}
