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
