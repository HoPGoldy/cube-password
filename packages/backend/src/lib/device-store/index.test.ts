import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDevice,
  findDevice,
  isGateEnabled,
  listDevices,
  PATH_TRUSTED_DEVICES,
  removeDevice,
  updateLastSeen,
} from "./index";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";

const TEST_DIR = "/tmp/cube-password-test/device-store";

/**
 * device-store 每次读都直读文件（不缓存），因此测试通过直接操作
 * TEST_DIR 下的 trusted-devices.json 来模拟「手工编辑/文件不存在」。
 * PATH_ROOT 被 mock 到 TEST_DIR，PATH_TRUSTED_DEVICES 随之指向测试目录，
 * 不会触碰 packages/backend/storage 下的真实数据。
 * 注意：vi.mock 工厂会被提升，路径字面量必须内联，不能引用外部变量。
 */
vi.mock("@/config/path", () => ({
  PATH_ROOT: "/tmp/cube-password-test/device-store",
}));

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("device-store", () => {
  it("reports gate disabled when the file does not exist", () => {
    expect(existsSync(PATH_TRUSTED_DEVICES)).toBe(false);
    expect(isGateEnabled()).toBe(false);
    expect(listDevices()).toEqual([]);
    expect(findDevice("whatever")).toBeUndefined();
  });

  it("reports gate disabled for an empty file and for an empty devices array", () => {
    writeFileSync(PATH_TRUSTED_DEVICES, "", "utf8");
    expect(isGateEnabled()).toBe(false);

    writeFileSync(PATH_TRUSTED_DEVICES, '{"devices":[]}', "utf8");
    expect(isGateEnabled()).toBe(false);
    expect(listDevices()).toEqual([]);
  });

  it("returns complete fields for devices written by hand", () => {
    writeFileSync(
      PATH_TRUSTED_DEVICES,
      JSON.stringify(
        {
          devices: [
            {
              id: "dev-1",
              name: "MacBook",
              publicKey: "MCowBQYDK2VwAyEA123",
              createdAt: "2026-02-10T08:00:00.000Z",
              lastSeenAt: "2026-02-10T09:00:00.000Z",
            },
            {
              id: "dev-2",
              name: "Phone",
              publicKey: "MCowBQYDK2VwAyEA456",
              createdAt: "2026-02-11T08:00:00.000Z",
              lastSeenAt: "2026-02-11T09:00:00.000Z",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const devices = listDevices();
    expect(devices).toHaveLength(2);
    expect(devices[0]).toEqual({
      id: "dev-1",
      name: "MacBook",
      publicKey: "MCowBQYDK2VwAyEA123",
      createdAt: "2026-02-10T08:00:00.000Z",
      lastSeenAt: "2026-02-10T09:00:00.000Z",
    });
    expect(devices[1].id).toBe("dev-2");
  });

  it("addDevice appends a nanoid-keyed device with full fields and persists it", () => {
    const created = addDevice({ name: "MacBook", publicKey: "PUBKEY_A" });

    expect(created.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(created.name).toBe("MacBook");
    expect(created.publicKey).toBe("PUBKEY_A");
    expect(created.createdAt).toBe(created.lastSeenAt);
    expect(new Date(created.createdAt).getTime()).not.toBeNaN();

    // 原子写后文件可回读（temp 已 rename 为正式文件）
    const raw = JSON.parse(readFileSync(PATH_TRUSTED_DEVICES, "utf8"));
    expect(raw.devices).toHaveLength(1);
    expect(raw.devices[0]).toEqual(created);

    expect(findDevice(created.id)).toEqual(created);
  });

  it("rejects adding a device with a duplicated public key", () => {
    addDevice({ name: "A", publicKey: "PUBKEY_DUP" });
    expect(() =>
      addDevice({ name: "B", publicKey: "PUBKEY_DUP" }),
    ).toThrowError(/already exists/);
    expect(listDevices()).toHaveLength(1);
  });

  it("updateLastSeen rewrites the file and bumps only lastSeenAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T08:00:00Z"));

    const created = addDevice({ name: "MacBook", publicKey: "PUBKEY_B" });

    vi.setSystemTime(new Date("2026-02-10T09:30:00Z"));
    updateLastSeen(created.id);

    const updated = findDevice(created.id);
    expect(updated?.lastSeenAt).toBe("2026-02-10T09:30:00.000Z");
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.name).toBe("MacBook");

    vi.useRealTimers();
  });

  it("removeDevice deletes the entry and persists the removal", () => {
    const a = addDevice({ name: "A", publicKey: "PUBKEY_C1" });
    const b = addDevice({ name: "B", publicKey: "PUBKEY_C2" });

    removeDevice(a.id);

    expect(findDevice(a.id)).toBeUndefined();
    expect(findDevice(b.id)).toEqual(b);
    expect(listDevices()).toHaveLength(1);
    // 还剩一台设备，门仍激活
    expect(isGateEnabled()).toBe(true);

    // devices 清空后门随之失效
    removeDevice(b.id);
    expect(isGateEnabled()).toBe(false);
  });

  it("updateLastSeen and removeDevice reject unknown ids", () => {
    expect(() => updateLastSeen("ghost")).toThrowError(/not found/i);
    expect(() => removeDevice("ghost")).toThrowError(/not found/i);
  });

  it("uses atomic write: a temp file does not outlive the write", () => {
    addDevice({ name: "MacBook", publicKey: "PUBKEY_E" });

    // temp+rename 之后不应残留 .temp 文件，目录里只有正式文件
    expect(readdirSync(TEST_DIR)).toEqual(["trusted-devices.json"]);
  });

  it("addDevice / updateLastSeen / removeDevice re-read the file so hand edits are picked up", () => {
    const created = addDevice({ name: "A", publicKey: "PUBKEY_F" });

    // 模拟手工编辑：绕过 API 直接改文件
    writeFileSync(
      PATH_TRUSTED_DEVICES,
      JSON.stringify({
        devices: [{ ...created, name: "Renamed by hand" }],
      }),
      "utf8",
    );

    expect(listDevices()[0].name).toBe("Renamed by hand");
    updateLastSeen(created.id);
    expect(findDevice(created.id)?.name).toBe("Renamed by hand");
  });

  it("throws an internal error on a corrupted file instead of silently disabling the gate", () => {
    writeFileSync(PATH_TRUSTED_DEVICES, "{ not json", "utf8");
    expect(() => isGateEnabled()).toThrowError(/not valid JSON/);
  });
});
