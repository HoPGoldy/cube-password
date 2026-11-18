import { ErrorBadRequest } from "@/types/error";

export class ErrorGroupNotFound extends ErrorBadRequest {
  constructor() {
    super("分组不存在");
    this.code = 40020;
  }
}

export class ErrorGroupUnlockFailed extends ErrorBadRequest {
  constructor() {
    super("分组解锁失败");
    this.code = 40021;
  }
}

export class ErrorGroupLockTypeUnknown extends ErrorBadRequest {
  constructor(lockType: string) {
    super(`未知的分组锁类型: ${lockType}`);
    this.code = 40022;
  }
}

export class ErrorGroupLastOne extends ErrorBadRequest {
  constructor() {
    super("至少保留一个分组，无法删除");
    this.code = 40023;
  }
}
