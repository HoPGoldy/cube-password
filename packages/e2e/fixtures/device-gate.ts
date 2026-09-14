import {
  test as base,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import {
  createPrivateKey,
  sign as nodeSign,
  type KeyObject,
} from "node:crypto";
import {
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { authHeaders, BASE, loginWithPassword, type SessionInfo } from "./api";

/**
 * 设备门（device gate）e2e 基建（见 docs/plans/device-gate/tasks/05-e2e-webcrypto.md）：
 *
 * - 服务端的设备清单 source of truth 是 packages/backend/storage/trusted-devices.json
 *   （dev 模式 PATH_ROOT = packages/backend/storage/），本文件提供该文件的原子化
 *   读写 helper；门的开闭唯一开关是 AppConfig deviceGateEnabled（gate-switch 新语义），
 *   激活态构造 = 清单非空 + 开关开启（双条件），统一走 enableGateViaApi /
 *   setupGateEnabled，用例前后另有开关兜底重置（resetGateConfig）
 * - 钥匙注入方案（评估后二选一的结论：**方案 B，浏览器侧生成 + 主动上报**）：
 *   - 方案 A（Node 生成 → SPKI 注册 → 浏览器再生成会不一致）需要让浏览器
 *     importKey 一个 extractable:true 的私钥 JWK——它写进 IndexedDB 后与正式
 *     代码 generateDeviceKeyPair 的「非导出私钥」语义不一致，且多一次往返
 *   - 方案 B：addInitScript 在浏览器自己的 crypto.subtle 里生成非导出钥匙对
 *     （与正式 lib/device-key.ts 的 generateDeviceKeyPair 完全同语义），privateKey
 *     句柄入 IndexedDB（库名 device-keys / store keys / key "pending"），publicKey
 *     SPKI base64 挂到 window 上，测试进程轮询读到后再经 /device/add 注册。
 *     pending（无 deviceId）+「省略 deviceId 遍历验签」路径服务端已支持
 *     （T03 silentVerify 回退 pending 槽 + T02 verify 遍历语义）
 * - signChallenge 提供与浏览器 silentVerify 同语义的 Node 侧签名
 *   （SHA-256 + raw r||s / ieee-p1363，base64），供纯 API 用例构造签名；
 *   writeDeviceKeyToIdb 把同一把 JWK 钥匙重导入浏览器句柄（仅测试基建需要），
 *   用于「IDB 已有钥匙但服务端未录入」等本地态构造
 */

/** trusted-devices.json 所在目录（dev 后端 PATH_ROOT = packages/backend/storage） */
const STORAGE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../backend/storage",
);

export const TRUSTED_DEVICES_PATH = join(STORAGE_DIR, "trusted-devices.json");

/** 原子化重置设备门：删除 trusted-devices.json（文件不存在即门未激活） */
export const resetTrustedDevicesFile = (): void => {
  rmSync(TRUSTED_DEVICES_PATH, { force: true });
};

/** 读取当前受信设备列表（文件不存在返回空数组） */
export const readTrustedDevices = (): Array<Record<string, unknown>> => {
  if (!existsSync(TRUSTED_DEVICES_PATH)) return [];
  const parsed = JSON.parse(readFileSync(TRUSTED_DEVICES_PATH, "utf8")) as {
    devices?: Array<Record<string, unknown>>;
  };
  return parsed.devices ?? [];
};

/**
 * 整文件写入 devices（等价手工编辑 trusted-devices.json）。
 * 服务端每次校验都直读文件，增删设备即时生效、无需重启。
 * 注意：本 helper 只改设备清单，不影响门开关（gate-switch 新语义）。
 */
export const writeTrustedDevices = (
  devices: Array<Record<string, unknown>>,
): void => {
  mkdirSync(STORAGE_DIR, { recursive: true });
  writeFileSync(
    TRUSTED_DEVICES_PATH,
    JSON.stringify({ devices }, null, 2),
    "utf8",
  );
};

// ---------- 设备门开关构造（gate-switch：AppConfig deviceGateEnabled 为唯一开关） ----------

/** dev 后端 SQLite（PATH_ROOT = packages/backend/storage，与设备清单同目录） */
const GATE_DB_PATH = join(STORAGE_DIR, "main.db");

const GATE_E2E_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "admin";

/**
 * 直删 dev 库 AppConfig 的 deviceGateEnabled（门开关兜底重置）。
 * 新语义下门开关独立于设备清单文件，仅删文件不再关门；用例内应优先用
 * disableGateViaApi 走 API 恢复，此处只兜底「用例中途失败泄漏开关」的场景
 * （每条用例前后调用）。库不存在（首跑未初始化）时静默跳过。
 */
export const resetGateConfig = (): void => {
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(GATE_DB_PATH);
    db.exec("DELETE FROM AppConfig WHERE key = 'deviceGateEnabled'");
  } catch {
    // 库文件尚不存在或被占用：忽略（兜底路径，不应让 hook 崩溃）
  } finally {
    db?.close();
  }
};

/**
 * 直读 dev 库 AppConfig.deviceGateEnabled 原始值（用于钉「手工编辑数据库生效」）。
 * 行缺失返回 null（后端缺省视为关）。
 */
export const readGateConfigValue = (): string | null => {
  const db = new DatabaseSync(GATE_DB_PATH, { readOnly: true });
  try {
    const row = db
      .prepare("SELECT value FROM AppConfig WHERE key = 'deviceGateEnabled'")
      .get() as { value: string } | undefined;
    return row?.value ?? null;
  } finally {
    db.close();
  }
};

/** 手工直改 dev 库 AppConfig 的 deviceGateEnabled（等价绕过 API 改配置） */
export const writeGateConfigValue = (value: string | null): void => {
  const db = new DatabaseSync(GATE_DB_PATH);
  try {
    if (value === null) {
      db.exec("DELETE FROM AppConfig WHERE key = 'deviceGateEnabled'");
    } else {
      db.prepare(
        "INSERT INTO AppConfig (key, value, createdAt, updatedAt) VALUES ('deviceGateEnabled', ?, datetime('now'), datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')",
      ).run(value);
    }
  } finally {
    db.close();
  }
};

/**
 * 录入一把受信设备（session 保护，门开关状态不限），返回服务端设备 id。
 * publicKey 为 SPKI 标准 base64（generateNodeSideKey / 浏览器注入钥匙均可）。
 */
export const addTrustedDeviceViaApi = async (
  request: APIRequestContext,
  session: SessionInfo,
  publicKey: string,
  name = "e2e-gate-device",
): Promise<string> => {
  const addResp = await request.post(`${BASE}/device/add`, {
    data: {
      deviceKey: buildDeviceKeyString({ name, publicKey }),
    },
    headers: authHeaders(session),
  });
  expect(addResp.status()).toBe(200);
  return ((await addResp.json()).data as { id: string }).id;
};

/** 开启设备门（session 保护；清单为空时后端 400 守卫拒绝） */
export const enableGateViaApi = async (
  request: APIRequestContext,
  session: SessionInfo,
): Promise<void> => {
  const resp = await request.post(`${BASE}/device/gate-config-update`, {
    data: { enabled: true },
    headers: authHeaders(session),
  });
  expect(resp.status()).toBe(200);
};

/** 关闭设备门（session 保护；设备清单原样保留） */
export const disableGateViaApi = async (
  request: APIRequestContext,
  session: SessionInfo,
): Promise<void> => {
  const resp = await request.post(`${BASE}/device/gate-config-update`, {
    data: { enabled: false },
    headers: authHeaders(session),
  });
  expect(resp.status()).toBe(200);
};

/**
 * 一步构造「门激活态」（新语义 = 清单非空 + 开关开启，双条件）：
 * 登录 → 录入一把新 Node 侧钥匙 → gate-config-update true。
 * 返回 session 与录入设备——门开后 loginWithPassword 会被 403，
 * 后续所有 session 接口必须复用这里返回的 session（互踢语义）。
 */
export const setupGateEnabled = async (
  request: APIRequestContext,
): Promise<{
  session: SessionInfo;
  device: { id: string; key: NodeSideKey };
}> => {
  const session = await loginWithPassword(request, GATE_E2E_PASSWORD);
  const key = await generateNodeSideKey();
  const id = await addTrustedDeviceViaApi(request, session, key.publicKey);
  await enableGateViaApi(request, session);
  return { session, device: { id, key } };
};

// ---------- 钥匙串组装（与前后端 cube-device-key:v1 格式一致） ----------

/** 追加一台手工设备（返回可回写的完整记录，id 由测试指定） */
export const makeManualDevice = (options: {
  id: string;
  publicKey: string;
  name?: string;
}): Record<string, unknown> => {
  const now = new Date().toISOString();
  return {
    id: options.id,
    name: options.name ?? "manual-device",
    publicKey: options.publicKey,
    createdAt: now,
    lastSeenAt: now,
  };
};

const DEVICE_KEY_PREFIX = "cube-device-key:v1:";

/** base64url（无 padding）编码 */
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

/** 组装设备钥匙串 cube-device-key:v1:<base64url(JSON{ name, publicKey })> */
export const buildDeviceKeyString = (payload: {
  name: string;
  publicKey: string;
}): string =>
  `${DEVICE_KEY_PREFIX}${toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  )}`;

// ---------- Node 侧生成 / 签名（纯 API 用例） ----------

export interface NodeSideKey {
  /** SPKI base64（标准 base64，进 trusted-devices.json / 钥匙串） */
  publicKey: string;
  /** 非导出 PKCS8 私钥的 JWK（Node 侧签名材料） */
  privateKeyJwk: JsonWebKey;
}

/**
 * 在 Node（playwright test 进程）里生成 ECDSA P-256 钥匙对并导出私钥 JWK +
 * 公钥 SPKI base64。仅用于纯 API 用例（不经浏览器）。
 */
export const generateNodeSideKey = async (): Promise<NodeSideKey> => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // Node 侧签名需要导出私钥字节（仅测试进程，无浏览器密钥库概念）
    ["sign"],
  );
  const spki = new Uint8Array(
    await crypto.subtle.exportKey("spki", pair.publicKey),
  );
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    publicKey: Buffer.from(spki).toString("base64"),
    privateKeyJwk,
  };
};

/**
 * 与前端 silentVerify 同语义的 Node 侧签名：
 * SHA-256 摘要 + raw r||s 输出（ieee-p1363，64 字节），base64 编码，
 * 与服务端 crypto.verify(..., { dsaEncoding: "ieee-p1363" }) 对齐。
 * （与后端集成测试的 webCryptoStyleSign 等价，但走 WebCrypto 接口生成材料）
 */
export const signChallenge = (
  privateKeyJwk: JsonWebKey,
  challenge: string,
): string => {
  const privateKeyObject = createPrivateKey({
    key: privateKeyJwk as never,
    format: "jwk",
  });
  return nodeSign("sha256", Buffer.from(challenge, "utf8"), {
    key: privateKeyObject as KeyObject,
    dsaEncoding: "ieee-p1363",
  }).toString("base64");
};

/** 完整过门三步（challenge → sign → verify），返回 gateToken（纯 API 用例用） */
export const knockGateViaApi = async (
  request: APIRequestContext,
  key: NodeSideKey,
  deviceId?: string,
): Promise<string> => {
  const challengeResp = await request.post("/api/device/challenge", {
    data: {},
  });
  expect(challengeResp.status()).toBe(200);
  const { challenge } = (await challengeResp.json()).data;

  const verifyResp = await request.post("/api/device/verify", {
    data: {
      deviceId,
      challenge,
      signature: signChallenge(key.privateKeyJwk, challenge),
    },
  });
  expect(verifyResp.status()).toBe(200);
  return (await verifyResp.json()).data.gateToken as string;
};

// ---------- 浏览器侧注入（addInitScript，与正式 lib/device-key.ts 同语义） ----------

/** window 上暂存的浏览器生成钥匙信息（测试进程读取用） */
export interface InjectedKeyInfo {
  name: string;
  /** SPKI base64（标准 base64，直接可用于 /device/add） */
  publicKey: string;
  createdAt: string;
}

/** IndexedDB 常量，必须与 packages/frontend/src/lib/device-key.ts 保持一致 */
export const DEVICE_KEY_IDB = { name: "device-keys", store: "keys" } as const;

/**
 * 浏览器侧生成 ECDSA P-256 非导出钥匙对（pass 给 addInitScript 的自包含函数体）：
 * - privateKey 句柄写入 IndexedDB device-keys/keys 的 "pending" 槽位（与正式
 *   generateDeviceKeyPair 的暂存语义一致）；库内已有钥匙时幂等跳过、直接上报
 * - 生成的 publicKey（SPKI base64）+ 元数据挂到 window.__e2eInjectedKey，
 *   供测试进程读取后走 /device/add 注册
 *
 * 必须自包含：addInitScript 只序列化函数源码，不捕获闭包。
 */
export function browserGenerateKeyInitScript(): void {
  const DB_NAME = "device-keys";
  const STORE_NAME = "keys";

  const openDb = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const report = (info: {
    name: string;
    publicKey: string;
    createdAt: string;
  }) => {
    (window as unknown as { __e2eInjectedKey?: typeof info }).__e2eInjectedKey =
      info;
  };

  const bytesToBase64 = (bytes: Uint8Array) => {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  };

  openDb().then((db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get("pending");
    getRequest.onsuccess = () => {
      const existing = getRequest.result as
        | { name: string; publicKey: string; createdAt: string }
        | undefined;
      if (existing) {
        // 幂等：本机已有 pending 钥匙（同一 context 二次导航），直接上报
        report(existing);
        return;
      }
      // 现场生成非导出钥匙对（与正式 generateDeviceKeyPair 同语义）
      crypto.subtle
        .generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
        .then(async (pair) => {
          const publicKey = bytesToBase64(
            new Uint8Array(
              await crypto.subtle.exportKey("spki", pair.publicKey),
            ),
          );
          const record = {
            name: "e2e-browser-device",
            publicKey,
            createdAt: new Date().toISOString(),
            privateKey: pair.privateKey,
          };
          store.put(record, "pending");
          tx.oncomplete = () =>
            report({
              name: record.name,
              publicKey: record.publicKey,
              createdAt: record.createdAt,
            });
        });
    };
  });
}

/** 从测试进程读取浏览器上报的注入钥匙信息（须等 initScript 完成写入后轮询到非空） */
export const readInjectedKey = (
  page: Page,
): Promise<InjectedKeyInfo | null> => {
  return page.evaluate(
    () =>
      (window as unknown as { __e2eInjectedKey?: InjectedKeyInfo })
        .__e2eInjectedKey ?? null,
  );
};

/** 轮询等待浏览器侧钥匙就绪（initScript 完成生成与上报）并返回非空信息 */
export const waitForInjectedKey = async (
  page: Page,
): Promise<InjectedKeyInfo> => {
  await expect
    .poll(() => readInjectedKey(page), { timeout: 10_000 })
    .not.toBeNull();
  const info = await readInjectedKey(page);
  expect(info).not.toBeNull();
  return info as InjectedKeyInfo;
};

/**
 * 把 Node 侧生成的私钥 JWK 重导入浏览器 CryptoKey 句柄并写进 IndexedDB
 * （仅测试基建需要；正式代码从不导出私钥）。deviceId 缺省写入 pending 槽位，
 * 配合服务端「省略 deviceId 遍历验签」路径。
 */
export const writeDeviceKeyToIdb = (
  page: Page,
  arg: {
    privateKeyJwk: JsonWebKey;
    name: string;
    deviceId?: string;
  },
): Promise<string> => {
  return page.evaluate(async ({ privateKeyJwk, name, deviceId }) => {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const spki = await crypto.subtle.exportKey(
      "spki",
      await crypto.subtle.importKey(
        "jwk",
        // 摘掉私钥字段得到公钥 JWK（WebCrypto importKey 拒绝带 d 的非对称 jwk 请求 [] 用途）
        { ...privateKeyJwk, d: undefined, key_ops: undefined, ext: undefined },
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        [],
      ),
    );
    let binary = "";
    for (const b of new Uint8Array(spki)) binary += String.fromCharCode(b);
    const publicKey = btoa(binary);

    const record = {
      ...(deviceId ? { deviceId } : {}),
      name,
      publicKey,
      createdAt: new Date().toISOString(),
      privateKey,
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("device-keys", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("keys");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keys", "readwrite");
      tx.objectStore("keys").put(record, deviceId ?? "pending");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return publicKey;
  }, arg);
};

/** 清空浏览器 context 的 IndexedDB device-keys 库（模拟「清 IDB」/ 丢钥匙） */
export const clearDeviceKeyIdb = (page: Page): Promise<void> => {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("device-keys");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
};

// ---------- 浏览器上下文 fixtures（保证门状态与钥匙隔离） ----------

interface GatePageFixtures {
  /** 全新浏览器 context：无 IndexedDB 钥匙、无登录态；用例内可再按需注入 */
  gatePage: Page;
}

/**
 * 设备门用例专用 test：每条用例前后原子化重置 trusted-devices.json +
 * 每用例全新浏览器 context（IndexedDB 与 localStorage 天然隔离，
 * 「全新 context 访问」用例直接用原始 browser.newContext 构造）。
 * 注意 workers=1（playwright.config），文件操作与前后端无并发竞争。
 */
export const gateTest = base.extend<GatePageFixtures>({
  gatePage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// 门状态兜底重置：即便个别用例中途失败，也不把激活态（设备清单 + 门开关）
// 泄漏给后续 spec（每条用例层面再显式控制）
base.beforeEach(() => {
  resetTrustedDevicesFile();
  resetGateConfig();
});
base.afterEach(() => {
  resetTrustedDevicesFile();
  resetGateConfig();
});
