/**
 * 设备门禁（device gate）前端流程（见 docs/plans/device-gate/context.md 3.3/3.4、T04
 * 与 docs/plans/ephemeral-gate-token/context.md 第 2 节 D-passgate/D-corridor）
 *
 * - probeGate：POST /device/challenge，登录页唯一探针（gateEnabled 回报门是否激活）
 * - passGate：IndexedDB 取本机钥匙（含 pending）→ silentVerify 签名挑战码 →
 *   POST /device/verify 换 gate token；任何一步失败抛类型化错误
 * - gate token 即取即用（ephemeral）：不落任何模块级状态，由 withGateToken 在单次
 *   调用栈内签发并消费，调用方经返回值使用后自然弃置，永不跨请求/跨页面持久
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

/**
 * 即取即用门禁执行器：探针确认门态 → 门激活时跑一遍完整过门（签名验签换临时
 * token），把 token 作为参数传给 fn 并返回其结果；门未激活时直接以 undefined
 * 调用 fn（纯密码模式，无需 token）。token 只存活于本次调用栈，不写入任何
 * 模块级状态——本函数返回即消亡。
 * 过门阶段失败（ErrorGateDenied / ErrorGateUnavailable）原样上抛，由调用方决定
 * 渲染；fn 自身抛出的错误不经包装直接透传。
 */
export const withGateToken = async <T>(
  fn: (gateToken: string | undefined) => Promise<T>,
): Promise<T> => {
  let probe: Awaited<ReturnType<typeof probeGate>>;
  try {
    probe = await probeGate();
  } catch (err) {
    throw new ErrorGateUnavailable(`门禁探针失败：${errorDetail(err)}`);
  }
  if (!probe.success) {
    throw new ErrorGateUnavailable(probe.message!);
  }
  if (!probe.data!.gateEnabled) return fn(undefined);
  const { gateToken } = await passGate(probe.data!.challenge);
  return fn(gateToken);
};

/** 门禁失败的可渲染信息：kind 区分「未授权」（走重绑指引）与「暂时不可用」（可重试） */
export interface GateDenial {
  kind: "unauthorized" | "unavailable";
  detail?: string;
}

/** 把 passGate/probeGate/withGateToken 抛出的错误归一化为页面可渲染的门禁失败信息 */
export const toGateDenial = (err: unknown): GateDenial => {
  if (err instanceof ErrorGateDenied) {
    return { kind: "unauthorized", detail: err.message };
  }
  if (err instanceof ErrorGateUnavailable) {
    return { kind: "unavailable", detail: err.message };
  }
  return { kind: "unavailable", detail: errorDetail(err) };
};
