import { ErrorBadRequest } from "@/types/error";

/**
 * 设备钥匙串格式（见 docs/plans/device-gate/context.md 3.3）：
 *   cube-device-key:v1:<base64url(JSON{ name, publicKey })>
 * 公钥为 SPKI base64，version 前缀预留演进。
 * 正式钥匙串由前端组装，后端只负责解析。
 */
const DEVICE_KEY_PREFIX = "cube-device-key:v1:";

export interface DeviceKeyPayload {
  name: string;
  publicKey: string;
}

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * 序列化设备钥匙串。
 * 仅供测试/工具用途：正式录入流程中钥匙串由前端组装。
 */
export const serializeDeviceKey = ({
  name,
  publicKey,
}: DeviceKeyPayload): string => {
  return `${DEVICE_KEY_PREFIX}${Buffer.from(
    JSON.stringify({ name, publicKey }),
    "utf8",
  ).toString("base64url")}`;
};

/**
 * 解析设备钥匙串，任何格式非法均抛 ErrorBadRequest：
 * - 前缀 / version 不符
 * - base64url 非法（字符集越界、长度 %4===1、非规范编码）
 * - 解码后不是合法 JSON
 * - JSON 结构不符（缺字段 / 类型不对）
 */
export const parseDeviceKey = (key: string): DeviceKeyPayload => {
  if (!key.startsWith(DEVICE_KEY_PREFIX)) {
    throw new ErrorBadRequest("Invalid device key: bad prefix or version");
  }

  const encoded = key.slice(DEVICE_KEY_PREFIX.length);

  // base64url 严格校验：Buffer.from 会静默容忍非法输入（截断、跳过越界字符），
  // 必须先校验字符集与长度，再校验规范性（重编码须与原文一致）
  if (
    !BASE64URL_PATTERN.test(encoded) ||
    encoded.length % 4 === 1 ||
    Buffer.from(encoded, "base64url").toString("base64url") !== encoded
  ) {
    throw new ErrorBadRequest("Invalid device key: bad base64url");
  }

  const json = Buffer.from(encoded, "base64url").toString("utf8");

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new ErrorBadRequest("Invalid device key: payload is not valid JSON");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as DeviceKeyPayload).name !== "string" ||
    (payload as DeviceKeyPayload).name.length === 0 ||
    typeof (payload as DeviceKeyPayload).publicKey !== "string" ||
    (payload as DeviceKeyPayload).publicKey.length === 0
  ) {
    throw new ErrorBadRequest(
      "Invalid device key: payload must be an object with non-empty string fields { name, publicKey }",
    );
  }

  const { name, publicKey } = payload as DeviceKeyPayload;
  return { name, publicKey };
};
