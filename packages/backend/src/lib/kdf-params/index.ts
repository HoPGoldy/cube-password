/**
 * 分组锁密码的 KDF 参数解析（与前端 e2ee kdf-params 语义对齐的后端内联实现）
 *
 * 前端的 parseKdfParams 位于 @frontend 包内，backend 无法直接依赖，故内联一份
 * 等价的宽松解析 + 校验。只接受当前明确支持的 algorithm/version，非法时由调用方
 * 转换为「旧版锁密码，请重新设置分组锁密码」错误（kdfParams 为空串即 v1 遗留）。
 */

export interface GroupKdfParams {
  algorithm: "argon2id";
  /** 内存成本 KiB */
  m: number;
  /** 时间成本（迭代次数） */
  t: number;
  /** 并行度 */
  p: number;
  /** 参数结构版本 */
  version: number;
}

/**
 * 解析并校验 Group.kdfParams JSON 字符串
 *
 * @throws {SyntaxError} JSON 非法
 * @throws {Error} 字段缺失 / 类型不符 / algorithm 或 version 不被支持
 */
export const parseGroupKdfParams = (raw: string): GroupKdfParams => {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("kdfParams 必须是 JSON 对象");
  }

  const { algorithm, m, t, p, version } = parsed as Record<string, unknown>;

  if (algorithm !== "argon2id") {
    throw new Error(`不支持的 KDF 算法 "${String(algorithm)}"`);
  }
  if (typeof p !== "number" || !Number.isInteger(p) || p < 1) {
    throw new Error("kdfParams.p 非法（须为 ≥ 1 的整数）");
  }
  if (typeof t !== "number" || !Number.isInteger(t) || t < 1) {
    throw new Error("kdfParams.t 非法（须为 ≥ 1 的整数）");
  }
  if (typeof m !== "number" || !Number.isInteger(m) || m < 8 * p) {
    throw new Error(
      `kdfParams.m 非法（须为 ≥ ${8 * p} 的整数，RFC 9106 最小内存限制）`,
    );
  }
  if (typeof version !== "number") {
    throw new Error("kdfParams.version 非法（须为数字）");
  }

  return { algorithm: "argon2id", m, t, p, version };
};
