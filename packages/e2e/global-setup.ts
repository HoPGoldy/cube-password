import { argon2id } from "hash-wasm";
import crypto from "crypto";
import { existsSync, rmSync } from "node:fs";
import {
  bytesToHex,
  hexToBytes,
  randomBytes,
  wrapDek,
  DEFAULT_KDF_PARAMS,
  parseKdfParams,
  type KdfParams,
} from "@frontend/lib/e2ee";

/**
 * 后端直连地址（baseURL 是前端开发服务器，setup 阶段必须使用后端的绝对地址）。
 * 可通过环境变量 E2E_BACKEND_URL 覆盖（CI 等场景）；端口与 playwright.config
 * 的 E2E_BACKEND_PORT 同源。
 */
const BACKEND_URL =
  process.env.E2E_BACKEND_URL ??
  `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 3499}`;

/** 登录密码，与 packages/e2e/.env 的 E2E_LOGIN_PASSWORD 一致 */
const LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

/**
 * 初始化固定盐（hex，可复现；ascii "e2e-fixed-salt" 共 14 字节，满足 RFC 9106 ≥8 字节）
 * v2 存储：passwordHash = hex(V)，V = argon2id(password, salt) 输出的后 32 字节；
 * 登录校验 SHA512(hex(V) + challengeCode)
 */
const FIXED_SALT_HEX = "6532652d66697865642d73616c74"; // ascii("e2e-fixed-salt")，14 字节（≥ RFC 9106 要求的 8 字节）

/** SHA-512（大写 hex），与后端一致 */
export const sha512 = (str: string): string => {
  return crypto
    .createHash("sha512")
    .update(str, "utf8")
    .digest("hex")
    .toUpperCase();
};

/** argon2id 输出 64B：前 32B = KEK，后 32B = V */
const KDF_HASH_LENGTH = 64;

/**
 * argon2id(password, salt) → { kek: 前 32B, verifier: 后 32B }，与前端 e2ee/kdf.ts 一致
 * @param params KDF 参数；闭环场景应传后端下发的 kdfParams（经 parseKdfParams 校验）
 */
const deriveMasterKey = async (
  password: string,
  saltBytes: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<{ kek: Uint8Array; verifier: Uint8Array }> => {
  const derived = await argon2id({
    password,
    salt: saltBytes,
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: KDF_HASH_LENGTH,
    outputType: "binary",
  });
  return {
    kek: derived.slice(0, 32),
    verifier: derived.slice(32, 64),
  };
};

interface GlobalData {
  isInitialized?: boolean;
  salt?: string;
  kdfParams?: string;
}

interface GlobalResponse {
  success?: boolean;
  data?: GlobalData;
}

/** 单次登录探测：challenge → login，返回是否成功（只探测 1 次，避免触发 3 次登录锁定） */
async function probeLogin(
  password: string,
  salt: string,
  kdfParams?: string,
): Promise<{ ok: boolean; body?: unknown }> {
  try {
    const challengeResp = await fetch(`${BACKEND_URL}/api/auth/challenge`, {
      method: "POST",
    });
    const challengeBody = await challengeResp.json();
    const code = challengeBody?.data?.code as string | undefined;
    if (!code) {
      return { ok: false, body: challengeBody };
    }

    // v2 流程：argon2id(密码, salt, kdfParams) → V → SHA512(hex(V) + challengeCode)；
    // kdfParams 经前端 parseKdfParams 严格校验（非法/不支持版本显式失败，不静默回落）
    const params = kdfParams ? parseKdfParams(kdfParams) : DEFAULT_KDF_PARAMS;
    const { verifier } = await deriveMasterKey(
      password,
      hexToBytes(salt),
      params,
    );
    const hash = sha512(bytesToHex(verifier) + code);
    const loginResp = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash }),
    });
    const body = await loginResp.json();
    return { ok: loginResp.ok && body?.success === true, body };
  } catch (err) {
    return { ok: false, body: String(err) };
  }
}

async function ensureInitialized() {
  const globalResp = await fetch(`${BACKEND_URL}/api/auth/global`, {
    method: "POST",
  });
  if (!globalResp.ok) {
    throw new Error(
      `无法访问后端 ${BACKEND_URL}/api/auth/global（HTTP ${globalResp.status}），请先启动后端服务。`,
    );
  }
  const globalBody = (await globalResp.json()) as GlobalResponse;
  if (!globalBody.success) {
    throw new Error(
      `POST /api/auth/global 返回失败：${JSON.stringify(globalBody)}`,
    );
  }

  const { isInitialized } = globalBody.data ?? {};

  // 数据库未初始化：用固定盐自动初始化管理员账号（v2 格式）
  if (!isInitialized) {
    const saltBytes = hexToBytes(FIXED_SALT_HEX);
    const { kek, verifier } = await deriveMasterKey(LOGIN_PASSWORD, saltBytes);
    // 全局 DEK：随机生成一次，以 keyBlob = AES-256-GCM(KEK, DEK) 存储
    const dek = randomBytes(32);
    const keyBlob = await wrapDek(kek, dek);

    const initResp = await fetch(`${BACKEND_URL}/api/auth/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verifier: bytesToHex(verifier),
        salt: FIXED_SALT_HEX,
        keyBlob,
        kdfParams: JSON.stringify(DEFAULT_KDF_PARAMS),
      }),
    });
    const initBody = await initResp.json();
    if (!initResp.ok || !initBody?.success) {
      throw new Error(
        `自动初始化用户失败（HTTP ${initResp.status}）：${JSON.stringify(initBody)}`,
      );
    }
    console.log(
      `[global-setup] 数据库未初始化，已自动创建管理员用户（v2 格式，E2E_LOGIN_PASSWORD=${LOGIN_PASSWORD}）`,
    );
    return;
  }

  // 数据库已初始化：单次登录探测校验密码是否与 E2E_LOGIN_PASSWORD 一致
  // （salt 与 kdfParams 均取自 /auth/global 下发，与前端登录流程同源）
  const salt = globalBody.data?.salt;
  if (!salt) {
    throw new Error(
      "数据库已初始化但缺少 passwordSalt（可能是旧版本库），无法校验密码。请重建数据库后重试。",
    );
  }

  const probe = await probeLogin(
    LOGIN_PASSWORD,
    salt,
    globalBody.data?.kdfParams,
  );
  if (!probe.ok) {
    throw new Error(
      `现有数据库的用户密码与 E2E_LOGIN_PASSWORD 不一致：期望 '${LOGIN_PASSWORD}'。` +
        `请重建数据库或设置正确的 E2E_LOGIN_PASSWORD。` +
        `（密码由 global-setup 自动初始化为 E2E_LOGIN_PASSWORD；复用已有开发库时必须与其一致。探测响应：${JSON.stringify(probe.body)}）`,
    );
  }
  console.log(
    `[global-setup] 数据库已初始化，密码校验通过（E2E_LOGIN_PASSWORD=${LOGIN_PASSWORD}）`,
  );
}

export default async function globalSetup() {
  resetTrustedDevices();
  await resetGateConfig();
  await ensureInitialized();
}

/**
 * 跨 run 兜底：清掉 AppConfig 里的设备门开关行（硬中断可能遗留 'true'，
 * 会使排在前面的 spec 撞 fail-closed 403；与 fixtures 的 per-case 双清对称）。
 */
const resetGateConfig = async () => {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(
      `${import.meta.dirname}/../backend/storage/main.db`,
    );
    db.exec("DELETE FROM AppConfig WHERE key = 'deviceGateEnabled'");
    db.close();
  } catch {
    // 库不存在等：忽略（ensureInitialized 前库可能尚未建表，届时 per-case 兜底接管）
  }
};

/**
 * 重置设备门：删除 trusted-devices.json（文件不存在即门未激活）。
 * dev 后端 PATH_ROOT = packages/backend/storage/；上一轮 e2e / 手工实验可能
 * 留下激活态，不清会使全部旧用例在登录走廊拿到 403（ErrorDeviceGate）。
 * device-gate.spec.ts 在用例层会再显式写/删此文件切换门状态（workers=1，无并发竞争）。
 */
const resetTrustedDevices = () => {
  const path = `${import.meta.dirname}/../backend/storage/trusted-devices.json`;
  if (existsSync(path)) {
    rmSync(path);
    console.log(
      "[global-setup] 已清理 trusted-devices.json（设备门重置为未激活）",
    );
  }
};
