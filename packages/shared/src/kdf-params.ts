/**
 * KDF 参数（与前端 e2ee kdf-params 完全一致的唯一实现）
 *
 * 双端共用：frontend 经 lib/e2ee/kdf.ts re-export，backend 直接 import。
 * 只接受当前代码明确支持的 algorithm/version，非法时由调用方决定如何兜底
 * （如分组锁场景转换为「旧版锁密码，请重新设置分组锁密码」错误）。
 */

/** argon2id 参数（版本化存 User.kdfParams / Group.kdfParams，调参无需迁移） */
export interface KdfParams {
  algorithm: "argon2id";
  /** 内存成本 KiB，默认 65536（64MiB） */
  m: number;
  /** 时间成本（迭代次数），默认 2 */
  t: number;
  /** 并行度，默认 1 */
  p: number;
  /** 参数结构版本 */
  version: number;
}

/** 默认参数（实施方案第 2 节决策） */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  m: 65536,
  t: 2,
  p: 1,
  version: 1,
};

/** kdfParams 字符串非法（JSON 非法、字段缺失或类型不符） */
export class ErrorInvalidKdfParams extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorInvalidKdfParams";
  }
}

/**
 * 解析并校验后端下发的 kdfParams JSON 字符串
 *
 * 只接受当前代码明确支持的 algorithm/version（argon2id / 1），其余直接抛错——
 * 版本化闭环的关键：参数不识别时必须显式失败，禁止静默回落默认值
 * （静默回落会导致派生出与库内 V 不一致的密钥，用户永远无法登录）。
 *
 * @throws {ErrorInvalidKdfParams} JSON 非法、字段缺失或类型不符时抛错
 */
export const parseKdfParams = (raw: string): KdfParams => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ErrorInvalidKdfParams("kdfParams 不是合法的 JSON 字符串");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ErrorInvalidKdfParams("kdfParams 必须是 JSON 对象");
  }

  const { algorithm, m, t, p, version } = parsed as Record<string, unknown>;

  if (algorithm !== "argon2id") {
    throw new ErrorInvalidKdfParams(
      `不支持的 KDF 算法 "${String(algorithm)}"（当前仅支持 argon2id），请升级应用`,
    );
  }
  if (typeof p !== "number" || !Number.isInteger(p) || p < 1) {
    throw new ErrorInvalidKdfParams("kdfParams.p 非法（须为 ≥ 1 的整数）");
  }
  if (typeof t !== "number" || !Number.isInteger(t) || t < 1) {
    throw new ErrorInvalidKdfParams("kdfParams.t 非法（须为 ≥ 1 的整数）");
  }
  if (typeof m !== "number" || !Number.isInteger(m) || m < 8 * p) {
    throw new ErrorInvalidKdfParams(
      `kdfParams.m 非法（须为 ≥ ${8 * p} 的整数，RFC 9106 最小内存限制）`,
    );
  }
  if (version !== 1) {
    throw new ErrorInvalidKdfParams(
      `不支持的 kdfParams 版本 ${String(version)}（当前支持 version 1），请升级应用`,
    );
  }

  return { algorithm: "argon2id", m, t, p, version };
};
