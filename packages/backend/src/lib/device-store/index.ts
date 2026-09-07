import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";
import { PATH_ROOT } from "@/config/path";
import { ErrorBadRequest, ErrorInternalServer } from "@/types/error";

/**
 * 设备门数据层（见 docs/plans/device-gate/context.md 3.2）：
 * trusted-devices.json 是唯一 source of truth，文件非空即门生效。
 * 每次验证直读文件，手工编辑（增删设备）即时生效、无需重启；
 * 写入用 temp+rename 原子写，避免写入中途崩溃留下半截文件。
 */

export const PATH_TRUSTED_DEVICES = join(PATH_ROOT, "trusted-devices.json");

export interface TrustedDevice {
  id: string;
  name: string;
  publicKey: string;
  createdAt: string;
  lastSeenAt: string;
}

interface TrustedDevicesFile {
  devices: TrustedDevice[];
}

/**
 * 解析 trusted-devices.json 原文。空 devices 数组视为门未激活。
 * 手工编辑产生的坏文件不支持静默降级（降级会静默关门/开门），
 * 直接抛内部错误暴露问题，由使用者修复或删除文件。
 */
const parseFile = (content: string): TrustedDevicesFile => {
  if (content.trim() === "") {
    return { devices: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ErrorInternalServer(
      `trusted-devices.json is not valid JSON: ${PATH_TRUSTED_DEVICES}`,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("devices" in parsed) ||
    !Array.isArray((parsed as TrustedDevicesFile).devices)
  ) {
    throw new ErrorInternalServer(
      `trusted-devices.json must have a devices array: ${PATH_TRUSTED_DEVICES}`,
    );
  }

  for (const device of (parsed as TrustedDevicesFile).devices) {
    if (
      typeof device !== "object" ||
      device === null ||
      typeof (device as TrustedDevice).id !== "string" ||
      typeof (device as TrustedDevice).name !== "string" ||
      typeof (device as TrustedDevice).publicKey !== "string" ||
      typeof (device as TrustedDevice).createdAt !== "string" ||
      typeof (device as TrustedDevice).lastSeenAt !== "string"
    ) {
      throw new ErrorInternalServer(
        `trusted-devices.json device entry is malformed: ${PATH_TRUSTED_DEVICES}`,
      );
    }
  }

  return parsed as TrustedDevicesFile;
};

/**
 * temp+rename 原子写：先写同目录 temp 文件再 rename，写入中途崩溃不会留下半截正式文件
 */
const writeFileAtomic = (devices: TrustedDevice[]): void => {
  const content = JSON.stringify({ devices }, null, 2);
  const tempPath = `${PATH_TRUSTED_DEVICES}.temp`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, PATH_TRUSTED_DEVICES);
};

const readDevicesFile = (): TrustedDevicesFile => {
  if (!existsSync(PATH_TRUSTED_DEVICES)) {
    return { devices: [] };
  }
  return parseFile(readFileSync(PATH_TRUSTED_DEVICES, "utf8"));
};

/** 读取全部受信设备（每次直读文件，手工编辑即时生效） */
export const listDevices = (): TrustedDevice[] => {
  return readDevicesFile().devices;
};

/** 门是否激活：文件不存在或 devices 为空即未激活 */
export const isGateEnabled = (): boolean => {
  return listDevices().length > 0;
};

/** 按 id 查找设备，不存在返回 undefined */
export const findDevice = (id: string): TrustedDevice | undefined => {
  return listDevices().find((device) => device.id === id);
};

/**
 * 新增设备（id 用 nanoid 生成），返回完整记录。
 * 公钥已存在于任意设备上时报错拒绝，杜绝重复绑定。
 */
export const addDevice = ({
  name,
  publicKey,
}: {
  name: string;
  publicKey: string;
}): TrustedDevice => {
  const { devices } = readDevicesFile();

  if (devices.some((device) => device.publicKey === publicKey)) {
    throw new ErrorBadRequest("Device public key already exists");
  }

  const now = new Date().toISOString();
  const device: TrustedDevice = {
    id: nanoid(),
    name,
    publicKey,
    createdAt: now,
    lastSeenAt: now,
  };

  writeFileAtomic([...devices, device]);
  return device;
};

/** 更新设备最后上线时间，设备不存在时报错 */
export const updateLastSeen = (id: string): void => {
  const { devices } = readDevicesFile();
  const target = devices.find((device) => device.id === id);
  if (!target) {
    throw new ErrorBadRequest(`Device not found: ${id}`);
  }

  target.lastSeenAt = new Date().toISOString();
  writeFileAtomic(devices);
};

/** 移除设备，设备不存在时报错 */
export const removeDevice = (id: string): void => {
  const { devices } = readDevicesFile();
  const next = devices.filter((device) => device.id !== id);
  if (next.length === devices.length) {
    throw new ErrorBadRequest(`Device not found: ${id}`);
  }

  writeFileAtomic(next);
};
