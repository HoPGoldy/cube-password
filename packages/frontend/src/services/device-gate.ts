/**
 * 设备门禁（device gate）前端流程（见 docs/plans/device-gate/context.md 3.3/3.4、T04）
 *
 * - probeGate：POST /device/challenge，登录页唯一探针（gateEnabled 回报门是否激活）
 * - passGate：IndexedDB 取本机钥匙（含 pending）→ silentVerify 签名挑战码 →
 *   POST /device/verify 换 gate token；任何一步失败抛类型化错误
 * - gateToken 只存内存模块级变量（10 分钟 TTL，与服务端 GateTokenManager 对齐），
 *   不进 localStorage；由 services/base 的拦截器在登录走廊四个请求上自动附带
 */
import { requestPost } from "./base";
import {
  ErrorNoLocalDeviceKey,
  listLocalDeviceKeys,
  silentVerify,
} from "@/lib/device-key";
import type {
  SchemaDeviceChallengeResponseType,
  SchemaDeviceVerifyResponseType,
} from "@shared-types/device";
import type { AppResponse } from "@/types/global";

/** 后端 ErrorDeviceGate 的业务错误码（403 + code 40301） */
export const ERROR_CODE_DEVICE_GATE = 40301;

/** gate token 客户端侧有效期，与服务端 GATE_TOKEN_TTL_MS（10 分钟）对齐 */
const GATE_TOKEN_TTL_MS = 10 * 60 * 1000;

/** 登录走廊路由（相对 baseURL 的 url），拦截器仅在这些请求上附带 gate token */
export const GATE_CORRIDOR_URLS = new Set([
  "auth/challenge",
  "auth/global",
  "auth/login",
  "auth/init",
]);

interface GateTokenState {
  token: string;
  expiresAt: number;
}

/** gate token 内存态（模块级变量，不落 localStorage） */
let gateTokenState: GateTokenState | undefined;

/** 过门成功后记录 gate token（起算 10 分钟客户端侧有效期） */
export const setGateToken = (token: string): void => {
  gateTokenState = { token, expiresAt: Date.now() + GATE_TOKEN_TTL_MS };
};

/** 丢弃 gate token（收到 40301 / 登录成功进入应用时调用） */
export const clearGateToken = (): void => {
  gateTokenState = undefined;
};

/** 取仍在有效期内的 gate token；已过期即丢弃 */
export const getValidGateToken = (): string | undefined => {
  if (!gateTokenState) return undefined;
  if (Date.now() >= gateTokenState.expiresAt) {
    gateTokenState = undefined;
    return undefined;
  }
  return gateTokenState.token;
};

/**
 * 判断 axios 错误是否为服务端设备门拒绝（HTTP 403 + ErrorDeviceGate 的 40301）
 */
export const isDeviceGateRejection = (err: unknown): boolean => {
  const response = (
    err as
      | { response?: { status?: number; data?: { code?: unknown } } }
      | null
      | undefined
  )?.response;
  return (
    response?.status === 403 && response?.data?.code === ERROR_CODE_DEVICE_GATE
  );
};

/** 门禁探针：POST /device/challenge（门禁豁免路由，始终可访问） */
export const probeGate = () => {
  return requestPost<SchemaDeviceChallengeResponseType>("device/challenge");
};

/** 本机未授权（无钥匙 / 验签被服务端拒绝）：渲染「此设备未授权」页并走重绑指引 */
export class ErrorGateDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorGateDenied";
  }
}

/** 门禁流程无法完成（网络 / IndexedDB / 非安全上下文等）：同样进门禁页但文案区分 */
export class ErrorGateUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorGateUnavailable";
  }
}

const errorDetail = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * 静默过门：用本机第一个可用钥匙句柄签名挑战码并向服务端验签换 gate token。
 * - 本机无任何钥匙 / 验签 403 ErrorDeviceGate → ErrorGateDenied
 * - 其余失败（非安全上下文 / 读取钥匙库 / 网络等）→ ErrorGateUnavailable
 * 注意：服务端验签前即 pop 挑战码（防重放），同一挑战码只有一次 verify 机会，
 * 因此只挑选一把钥匙发起一次验签（优先已关联服务端 id 的记录，其次 pending 槽位）。
 */
export const passGate = async (
  challenge: string,
): Promise<{ gateToken: string }> => {
  // 签名依赖 WebCrypto，非安全上下文（非 HTTPS 且非 localhost）下明确报因
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new ErrorGateUnavailable(
      "WebCrypto 不可用：设备门需要安全上下文（HTTPS 或 localhost）",
    );
  }

  // 1. 取本机钥匙（含 pending 槽位）
  let keys: Awaited<ReturnType<typeof listLocalDeviceKeys>>;
  try {
    keys = await listLocalDeviceKeys();
  } catch (err) {
    throw new ErrorGateUnavailable(`读取本机设备钥匙失败：${errorDetail(err)}`);
  }
  const record =
    keys.find((key) => typeof key.deviceId === "string") ?? keys[0];
  if (!record) {
    throw new ErrorGateDenied("本机没有设备钥匙");
  }

  // 2. 句柄签名挑战码（私钥字节不出浏览器密钥库）
  let signature: string;
  try {
    signature = await silentVerify(record.deviceId, challenge);
  } catch (err) {
    if (err instanceof ErrorNoLocalDeviceKey) {
      throw new ErrorGateDenied("本机没有可用的设备钥匙");
    }
    throw new ErrorGateUnavailable(`设备钥匙签名失败：${errorDetail(err)}`);
  }

  // 3. 服务端验签换 gate token；拒绝（403 ErrorDeviceGate）→ 未授权
  let resp: AppResponse<SchemaDeviceVerifyResponseType>;
  try {
    resp = await requestPost<SchemaDeviceVerifyResponseType>("device/verify", {
      deviceId: record.deviceId,
      challenge,
      signature,
    });
  } catch (err) {
    if (isDeviceGateRejection(err)) {
      throw new ErrorGateDenied("设备验签未通过");
    }
    throw new ErrorGateUnavailable(`门禁验证请求失败：${errorDetail(err)}`);
  }

  if (!resp.success || !resp.data?.gateToken) {
    throw new ErrorGateUnavailable("门禁验证响应异常");
  }
  return { gateToken: resp.data.gateToken };
};

/** 门禁失败的可渲染信息：kind 区分「未授权」（走重绑指引）与「暂时不可用」（可重试） */
export interface GateDenial {
  kind: "unauthorized" | "unavailable";
  detail?: string;
}

/** 把 passGate/probeGate 抛出的错误归一化为页面可渲染的门禁失败信息 */
export const toGateDenial = (err: unknown): GateDenial => {
  if (err instanceof ErrorGateDenied) {
    return { kind: "unauthorized", detail: err.message };
  }
  if (err instanceof ErrorGateUnavailable) {
    return { kind: "unavailable", detail: err.message };
  }
  return { kind: "unavailable", detail: errorDetail(err) };
};
