/**
 * 设备钥匙（device key）浏览器端管理（见 docs/plans/device-gate/context.md 3.4）
 *
 * - 生成：WebCrypto ECDSA P-256，extractable: false（私钥字节永不出浏览器密钥库），
 *   公钥导出 SPKI base64 组装进钥匙串
 * - 存储：私钥句柄（CryptoKey，structured clone 可直接入库）+ 元数据存 IndexedDB
 *   （库名 device-keys，store: keys），固定单槽单条：一机一钥，重新生成即覆盖。
 *   公钥即身份——「本机是哪台受信设备」由公钥比对得出，不在本地维护设备 id 映射
 * - 钥匙串格式：cube-device-key:v1:<base64url(JSON{ name, publicKey })>，
 *   与后端 packages/backend/src/lib/device-key 共同遵守
 * - 静默过门：silentVerify(deviceId, challenge) 用句柄签名挑战码，返回 base64url 签名
 *   （raw r||s，与后端 dsaEncoding: 'ieee-p1363' 对齐，spike/verify-demo.mjs 已验证）
 */

/** 钥匙串版本前缀（与后端 DEVICE_KEY_PREFIX 一致） */
export const DEVICE_KEY_PREFIX = "cube-device-key:v1:";

/** IndexedDB 库名 */
const DB_NAME = "device-keys";
/** IndexedDB object store 名 */
const STORE_NAME = "keys";
/** 本机钥匙唯一槽位：一机一钥，重新生成即覆盖（旧钥匙同时作废） */
export const LOCAL_DEVICE_KEY_SLOT = "local";

/** 钥匙串格式非法（前缀 / base64url / JSON / 字段结构任一校验不通过） */
export class ErrorInvalidDeviceKey extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorInvalidDeviceKey";
  }
}

/** 本机不存在指定设备 id 的钥匙句柄（未生成 / 已清除 / 换浏览器或 profile） */
export class ErrorNoLocalDeviceKey extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorNoLocalDeviceKey";
  }
}

/** 钥匙串载荷（与后端 parseDeviceKey 的返回结构一致） */
export interface DeviceKeyPayload {
  name: string;
  publicKey: string;
}

/** 本机钥匙记录（私钥句柄 + 元数据），存 IndexedDB 固定槽位 */
export interface LocalDeviceKey {
  name: string;
  /** SPKI base64（标准 base64，与 trusted-devices.json 的 publicKey 一致） */
  publicKey: string;
  /** 生成时间（ISO 8601） */
  createdAt: string;
  /** 非导出私钥句柄（字节本体在浏览器内部密钥库，页面代码拿不到） */
  privateKey: CryptoKey;
}

// ---------- base64 / base64url 编解码（浏览器原生 API 实现） ----------

/** 字节转标准 base64（分块避免 String.fromCharCode 展开参数栈溢出） */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
};

/** 字节转 base64url（URL 安全字母表，无 padding） */
export const bytesToBase64Url = (bytes: Uint8Array): string => {
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

/** base64url 转字节（仅接受 URL 安全字母表；padding 可省略） */
export const base64UrlToBytes = (encoded: string): Uint8Array => {
  const base64 =
    encoded.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// ---------- 钥匙串组装 / 解析 ----------

/** 组装设备钥匙串 cube-device-key:v1:<base64url(JSON{ name, publicKey })> */
export const buildDeviceKey = ({
  name,
  publicKey,
}: DeviceKeyPayload): string => {
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ name, publicKey })),
  );
  return `${DEVICE_KEY_PREFIX}${payload}`;
};

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * 解析设备钥匙串（用于录入前的本地友好校验），任何格式非法均抛 {@link ErrorInvalidDeviceKey}。
 * 校验逻辑与后端 packages/backend/src/lib/device-key 的 parseDeviceKey 对齐。
 */
export const parseDeviceKey = (key: string): DeviceKeyPayload => {
  if (typeof key !== "string" || !key.startsWith(DEVICE_KEY_PREFIX)) {
    throw new ErrorInvalidDeviceKey("missing or unknown version prefix");
  }

  const encoded = key.slice(DEVICE_KEY_PREFIX.length);
  if (!BASE64URL_PATTERN.test(encoded) || encoded.length % 4 === 1) {
    throw new ErrorInvalidDeviceKey("payload is not valid base64url");
  }

  const bytes = base64UrlToBytes(encoded);
  // 规范性校验：重编码须与原文一致（拦截末位量化比特非零的非规范编码）
  if (bytesToBase64Url(bytes) !== encoded) {
    throw new ErrorInvalidDeviceKey("payload is not canonical base64url");
  }

  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ErrorInvalidDeviceKey("payload is not valid UTF-8");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new ErrorInvalidDeviceKey("payload is not valid JSON");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as DeviceKeyPayload).name !== "string" ||
    (payload as DeviceKeyPayload).name.length === 0 ||
    typeof (payload as DeviceKeyPayload).publicKey !== "string" ||
    (payload as DeviceKeyPayload).publicKey.length === 0
  ) {
    throw new ErrorInvalidDeviceKey(
      "payload must be an object with non-empty string fields { name, publicKey }",
    );
  }

  const { name, publicKey } = payload as DeviceKeyPayload;
  return { name, publicKey };
};

// ---------- IndexedDB 极简 promise 封装（零依赖） ----------

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("failed to open IndexedDB"));
  });
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await requestToPromise(
      run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)),
    );
  } finally {
    db.close();
  }
};

const idbGet = () =>
  withStore(
    "readonly",
    (store) =>
      store.get(LOCAL_DEVICE_KEY_SLOT) as IDBRequest<
        LocalDeviceKey | undefined
      >,
  );

const idbPut = async (value: LocalDeviceKey): Promise<void> => {
  await withStore("readwrite", (store) =>
    store.put(value, LOCAL_DEVICE_KEY_SLOT),
  );
};

const idbDelete = async (): Promise<void> => {
  await withStore("readwrite", (store) => store.delete(LOCAL_DEVICE_KEY_SLOT));
};

// ---------- 本机钥匙：生成 / 查询 / 关联 / 清除 ----------

export interface GeneratedDeviceKey extends DeviceKeyPayload {
  /** 组装好的钥匙串（拿去已授权设备录入，或本机直接添加） */
  deviceKey: string;
  /** 生成时间（ISO 8601） */
  createdAt: string;
}

/**
 * 生成本机设备钥匙：写入固定槽位（覆盖旧钥匙，旧钥匙即时作废），
 * 公钥组装成钥匙串返回。
 */
export const generateDeviceKeyPair = async (
  name: string,
): Promise<GeneratedDeviceKey> => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error(
      "WebCrypto is unavailable (requires a secure context: HTTPS or localhost)",
    );
  }

  // extractable: false 只作用于私钥——公钥永远可导出（规范行为）
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const publicKey = bytesToBase64(new Uint8Array(spki));
  const createdAt = new Date().toISOString();

  await idbPut({
    name,
    publicKey,
    createdAt,
    privateKey: pair.privateKey,
  });

  return {
    deviceKey: buildDeviceKey({ name, publicKey }),
    name,
    publicKey,
    createdAt,
  };
};

/** 读取本机钥匙记录（固定槽位，无钥匙时 undefined） */
export const getLocalDeviceKey = (): Promise<LocalDeviceKey | undefined> =>
  idbGet();

/** 清除本机钥匙记录（吊销本机/重置） */
export const clearLocalDeviceKey = (): Promise<void> => idbDelete();

// ---------- 静默签名（每次登录的静默过门，用户零感知） ----------

/**
 * 用本机句柄对服务端下发的设备挑战码签名，返回 base64url 签名
 * （raw r||s，64 字节，与后端 dsaEncoding: 'ieee-p1363' 验签对齐）。
 * T04 的静默过门流程用它组装 challenge → sign → verify 三步。
 * 服务端对全部受信设备逐一验签（省略 deviceId），本机无需知道自己的服务端 id。
 */
export const silentVerify = async (challenge: string): Promise<string> => {
  const record = await getLocalDeviceKey();
  if (!record) {
    throw new ErrorNoLocalDeviceKey("no local device key");
  }

  // 挑战码按其字符串原文的 UTF-8 字节签名（与后端 Buffer.from(challenge, 'utf8') 对齐）
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    record.privateKey,
    new TextEncoder().encode(challenge),
  );
  return bytesToBase64Url(new Uint8Array(signature));
};

// ---------- 设备名建议 ----------

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];

// 顺序敏感：Android UA 含 Linux、iOS UA 含 Mac OS X，需先于它们匹配
const OS_PATTERNS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

/** 从 userAgent 猜一个可读的默认设备名（如 "Chrome on macOS"） */
export const suggestDeviceName = (
  userAgent: string = navigator.userAgent,
): string => {
  const browser = BROWSER_PATTERNS.find(([pattern]) =>
    pattern.test(userAgent),
  )?.[1];
  const os = OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return `${browser ?? "Browser"} on ${os ?? "Device"}`;
};
