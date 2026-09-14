import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import type { KeyObject } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

/**
 * DeviceService 单测。
 * device-store 每次验证都直读 trusted-devices.json，因此用 mock PATH_ROOT
 * 指向临时目录 + 真实 P-256 密钥对写入文件来构造测试向量；
 * PATH_ROOT 的 vi.mock 工厂会被提升，路径字面量必须内联。
 */
const TEST_DIR = "/tmp/cube-password-test/device-service";

vi.mock("@/config/path", () => ({
  PATH_ROOT: "/tmp/cube-password-test/device-service",
}));

import { DeviceService } from "./service";
import { ErrorDeviceGate } from "./error";
import { ChallengeManager } from "@/lib/challenge";
import { GateTokenManager } from "@/lib/gate-token";
import { serializeDeviceKey } from "@/lib/device-key";
import { NoticeType } from "@/types/notification";
import { PATH_TRUSTED_DEVICES } from "@/lib/device-store";

const generateP256 = () => generateKeyPairSync("ec", { namedCurve: "P-256" });
type P256Pair = ReturnType<typeof generateP256>;

/**
 * AppConfigService 内存桩：与真实实现同构的 findKey/setConfigValues 语义
 * （key-value 存储，deviceGateEnabled 缺省视为 false），不触 Prisma。
 */
const makeAppConfigStub = () => {
  const store = new Map<string, string>();
  return {
    findByKey: async (key: string) =>
      store.has(key) ? { key, value: store.get(key)! } : null,
    setConfigValues: async (configs: Record<string, string>) => {
      for (const [key, value] of Object.entries(configs)) {
        store.set(key, value);
      }
    },
  };
};

/** 按 WebCrypto 语义签名：hash 先行 + raw r||s 输出，等价浏览器 crypto.subtle.sign 的结果 */
const webCryptoStyleSign = (privateKey: KeyObject, data: string): string => {
  return nodeSign("sha256", Buffer.from(data, "utf8"), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64");
};

const makeDeps = (
  notices: { title: string; content: string; type: number }[] = [],
) => {
  const gateTokenManager = new GateTokenManager();
  const deps = {
    deviceChallengeManager: new ChallengeManager(),
    gateTokenManager,
    notificationService: {
      createNotice: async (title: string, content: string, type: number) => {
        notices.push({ title, content, type });
      },
      hasUnread: async () => false,
    },
    appConfigService: makeAppConfigStub(),
  } as ConstructorParameters<typeof DeviceService>[0];
  return { deps, gateTokenManager, notices };
};

/** 写入一台设备（真实 P-256 公钥，SPKI base64），返回其私钥与登记 id */
const seedDevice = (
  overrides: Partial<{ id: string; name: string }> = {},
): { privateKey: KeyObject; deviceId: string; publicKeyB64: string } => {
  const pair = generateP256();
  const publicKeyB64 = pair.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  const id = overrides.id ?? "device-1";
  const name = overrides.name ?? "TestDevice";
  // 追加而非覆写：支持一个用例内 seed 多台设备（遍历验签用例需要）
  const existing = existsSync(PATH_TRUSTED_DEVICES)
    ? (JSON.parse(readFileSync(PATH_TRUSTED_DEVICES, "utf8")) as {
        devices: unknown[];
      })
    : { devices: [] };
  existing.devices.push({
    id,
    name,
    publicKey: publicKeyB64,
    createdAt: "2026-02-10T08:00:00.000Z",
    lastSeenAt: "2026-02-10T08:00:00.000Z",
  });
  writeFileSync(
    PATH_TRUSTED_DEVICES,
    JSON.stringify(existing, null, 2),
    "utf8",
  );
  return { privateKey: pair.privateKey, deviceId: id, publicKeyB64 };
};

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-10T08:00:00Z"));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DeviceService.verify - ieee-p1363 验签", () => {
  it("accepts a valid ieee-p1363 signature and issues a usable gate token", async () => {
    const { deps, gateTokenManager } = makeDeps();
    const service = new DeviceService(deps);
    const { privateKey, deviceId } = seedDevice();

    const { challenge } = await service.getChallenge();
    const signature = webCryptoStyleSign(privateKey, challenge);

    const { gateToken } = service.verify({ deviceId, challenge, signature });
    expect(gateToken).toEqual(expect.any(String));
    // 签发的 token 能过门禁校验
    expect(gateTokenManager.validateToken(gateToken)).toBe(true);
  });

  it("rejects a tampered signature with 403 ErrorDeviceGate", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { privateKey, deviceId } = seedDevice();

    const { challenge } = await service.getChallenge();
    const sigBuf = Buffer.from(
      webCryptoStyleSign(privateKey, challenge),
      "base64",
    );
    sigBuf[0] ^= 0xff; // 篡改 1 字节

    expect(() =>
      service.verify({
        deviceId,
        challenge,
        signature: sigBuf.toString("base64"),
      }),
    ).toThrowError(ErrorDeviceGate);
  });

  it("rejects a signature signed by a foreign key", async () => {
    const service = new DeviceService(makeDeps().deps);
    seedDevice({ id: "device-1" });

    // 攻击者自己的钥匙（不在钥匙串中）
    const attacker = generateP256();
    const { challenge } = await service.getChallenge();
    const signature = webCryptoStyleSign(attacker.privateKey, challenge);

    expect(() =>
      service.verify({ deviceId: "device-1", challenge, signature }),
    ).toThrowError(ErrorDeviceGate);
  });

  it("updates lastSeenAt after a successful verify", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { privateKey, deviceId } = seedDevice();

    const { challenge } = await service.getChallenge();
    // verify 时刻推进 2 分钟（在 5 分钟挑战码 TTL 内，且早于同一时刻的 lastSeenAt）
    vi.setSystemTime(new Date("2026-02-10T08:02:00Z"));
    service.verify({
      deviceId,
      challenge,
      signature: webCryptoStyleSign(privateKey, challenge),
    });

    // 直读文件确认回写（绕过 service）
    const raw = JSON.parse(readFileSync(PATH_TRUSTED_DEVICES, "utf8")) as {
      devices: { lastSeenAt: string }[];
    };
    expect(raw.devices[0].lastSeenAt).toBe("2026-02-10T08:02:00.000Z");
  });
});

describe("DeviceService.verify - 挑战码一次性消费（防重放）", () => {
  it("fails the second verify with the same challenge", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { privateKey, deviceId } = seedDevice();

    const { challenge } = await service.getChallenge();
    const signature = webCryptoStyleSign(privateKey, challenge);

    expect(
      service.verify({ deviceId, challenge, signature }).gateToken,
    ).toEqual(expect.any(String));

    // 同一挑战码重放：pop 已消费 → 403
    expect(() =>
      service.verify({ deviceId, challenge, signature }),
    ).toThrowError(ErrorDeviceGate);
  });

  it("rejects a challenge that was never issued", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { privateKey, deviceId } = seedDevice();
    expect(() =>
      service.verify({
        deviceId,
        challenge: "never-issued",
        signature: webCryptoStyleSign(privateKey, "never-issued"),
      }),
    ).toThrowError(ErrorDeviceGate);
  });

  it("rejects an unknown deviceId", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { privateKey } = seedDevice();
    const { challenge } = await service.getChallenge();
    expect(() =>
      service.verify({
        deviceId: "ghost",
        challenge,
        signature: webCryptoStyleSign(privateKey, challenge),
      }),
    ).toThrowError(ErrorDeviceGate);
  });

  it("deviceId omitted: verifies against all trusted devices (cross-device enrollment)", async () => {
    const service = new DeviceService(makeDeps().deps);
    // 两台受信设备，签名若来自第二台的私钥
    seedDevice({ id: "device-a", name: "Device A" });
    const second = seedDevice({ id: "device-b", name: "Device B" });
    const { challenge } = await service.getChallenge();

    // 不携带 deviceId：服务端遍历全部设备验签，命中 device-b
    const { gateToken } = service.verify({
      challenge,
      signature: webCryptoStyleSign(second.privateKey, challenge),
    });
    expect(gateToken).toEqual(expect.any(String));
  });

  it("deviceId omitted: no matching key among trusted devices still fails", async () => {
    const service = new DeviceService(makeDeps().deps);
    seedDevice();
    // 未受信的陌生钥签名
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const { challenge } = await service.getChallenge();
    expect(() =>
      service.verify({
        challenge,
        signature: webCryptoStyleSign(privateKey, challenge),
      }),
    ).toThrowError(ErrorDeviceGate);
  });

  it("device challenge and login challenge managers are independent", async () => {
    const { deps } = makeDeps();
    const service = new DeviceService(deps);
    const loginManager = new ChallengeManager();

    // 登录挑战码的消费不影响设备挑战码（独立实例，互不覆盖）
    loginManager.generateChallenge();
    const { challenge: deviceChallenge } = await service.getChallenge();
    loginManager.popLastChallenge();

    const { privateKey, deviceId } = seedDevice();
    const signature = webCryptoStyleSign(privateKey, deviceChallenge);
    expect(() =>
      service.verify({ deviceId, challenge: deviceChallenge, signature }),
    ).not.toThrowError();
  });
});

describe("DeviceService.verify - 敲门失败通知去重", () => {
  it("two failures within the window produce exactly one Warning notice with the source ip", async () => {
    const { deps, notices } = makeDeps();
    const service = new DeviceService(deps);
    seedDevice();

    // 两次失败（未知设备 + 未知设备）；createNotice 桩同步入列，无需 flush
    const knock = () =>
      service.verify(
        { deviceId: "ghost", challenge: "x", signature: "y" },
        "203.0.113.7",
      );
    expect(knock).toThrowError(ErrorDeviceGate);
    expect(knock).toThrowError(ErrorDeviceGate);

    expect(notices).toHaveLength(1);
    expect(notices[0].type).toBe(NoticeType.Warning);
    expect(notices[0].content).toContain("203.0.113.7");
  });

  it("a new failure after the 1 hour window produces another notice", async () => {
    const { deps, notices } = makeDeps();
    const service = new DeviceService(deps);
    seedDevice();

    const knock = () =>
      service.verify(
        { deviceId: "ghost", challenge: "x", signature: "y" },
        "ip",
      );
    expect(knock).toThrowError(ErrorDeviceGate);
    expect(notices).toHaveLength(1);

    // 去重窗口内不再落通知
    vi.advanceTimersByTime(60 * 60 * 1000 - 1);
    expect(knock).toThrowError(ErrorDeviceGate);
    expect(notices).toHaveLength(1);

    // 窗口过后重新落一条
    vi.advanceTimersByTime(1);
    expect(knock).toThrowError(ErrorDeviceGate);
    expect(notices).toHaveLength(2);
  });

  it("a successful verify does not create a notice", async () => {
    const { deps, notices } = makeDeps();
    const service = new DeviceService(deps);
    const { privateKey, deviceId } = seedDevice();

    const { challenge } = await service.getChallenge();
    service.verify({
      deviceId,
      challenge,
      signature: webCryptoStyleSign(privateKey, challenge),
    });
    expect(notices).toHaveLength(0);
  });
});

describe("DeviceService.add / list / revoke", () => {
  it("add parses a device key and registers the device", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { publicKey } = generateP256();
    const spki = publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    const deviceKey = serializeDeviceKey({ name: "MacBook", publicKey: spki });

    const { id } = service.add(deviceKey);
    expect(id).toEqual(expect.any(String));

    const { items } = service.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id, name: "MacBook", publicKey: spki });
  });

  it("add rejects a duplicated public key", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { publicKey } = generateP256();
    const spki = publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    const deviceKey = serializeDeviceKey({ name: "A", publicKey: spki });

    service.add(deviceKey);
    expect(() =>
      service.add(serializeDeviceKey({ name: "B", publicKey: spki })),
    ).toThrowError(/already exists/);
  });

  it("revoke removes the device; the gate stays as configured (file only tracks devices)", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { publicKey } = generateP256();
    const spki = publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64");
    const { id } = service.add(
      serializeDeviceKey({ name: "Solo", publicKey: spki }),
    );

    // 门未开启时探针回报 false——即使文件已有设备（新语义）
    expect((await service.getChallenge()).gateEnabled).toBe(false);

    // 开启后吊销全部设备：门仍开（fail-closed），文件只做设备清单
    await service.updateGateConfig(true);
    expect((await service.getChallenge()).gateEnabled).toBe(true);
    service.revoke(id);
    expect(service.list().items).toHaveLength(0);
    expect((await service.getChallenge()).gateEnabled).toBe(true);
  });

  it("revoke rejects an unknown id", () => {
    const service = new DeviceService(makeDeps().deps);
    expect(() => service.revoke("ghost")).toThrowError(/not found/i);
  });

  it("gateConfig defaults to enabled=false with deviceCount=0 on a fresh store", async () => {
    const service = new DeviceService(makeDeps().deps);
    await expect(service.gateConfig()).resolves.toEqual({
      enabled: false,
      deviceCount: 0,
    });
  });

  it("updateGateConfig round-trips the AppConfig value", async () => {
    const service = new DeviceService(makeDeps().deps);
    const { publicKey } = generateP256();
    service.add(
      serializeDeviceKey({
        name: "Solo",
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
      }),
    );

    await service.updateGateConfig(true);
    await expect(service.gateConfig()).resolves.toMatchObject({
      enabled: true,
      deviceCount: 1,
    });

    // 关闭不动设备清单：deviceCount 保持 1
    await service.updateGateConfig(false);
    await expect(service.gateConfig()).resolves.toEqual({
      enabled: false,
      deviceCount: 1,
    });
  });

  it("updateGateConfig rejects enabling with zero devices", async () => {
    const service = new DeviceService(makeDeps().deps);
    await expect(service.updateGateConfig(true)).rejects.toThrowError(
      /请先绑定至少一台设备/,
    );
    // 守卫拒绝后开关保持关闭
    await expect(service.gateConfig()).resolves.toMatchObject({
      enabled: false,
    });
  });

  it("updateGateConfig rejects enabling when the devices file exists but is empty", async () => {
    const service = new DeviceService(makeDeps().deps);
    writeFileSync(PATH_TRUSTED_DEVICES, '{"devices":[]}', "utf8");
    await expect(service.updateGateConfig(true)).rejects.toThrowError(
      /请先绑定至少一台设备/,
    );
  });

  it("treats any AppConfig value other than 'true' as disabled", async () => {
    const deps = makeDeps().deps;
    // 缺省（无记录）与写 'false' 均为关；模拟历史脏值同理
    const service = new DeviceService(deps);
    await expect(service.isGateEnabled()).resolves.toBe(false);
    await deps.appConfigService.setConfigValues({
      deviceGateEnabled: "false",
    });
    await expect(service.isGateEnabled()).resolves.toBe(false);
    await deps.appConfigService.setConfigValues({
      deviceGateEnabled: "1",
    });
    await expect(service.isGateEnabled()).resolves.toBe(false);
  });
});
