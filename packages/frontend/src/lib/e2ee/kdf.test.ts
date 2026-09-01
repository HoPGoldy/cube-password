import { describe, expect, it } from "vitest";
import {
  DEFAULT_KDF_PARAMS,
  DERIVED_LENGTH,
  KEK_LENGTH,
  SALT_LENGTH,
  VERIFIER_LENGTH,
  deriveMasterKey,
} from "./kdf";
import { randomBytes } from "./random";

/** 低成本参数，仅用于非默认参数的行为测试（argON2 最小 m 为 8 * p KiB） */
const FAST_PARAMS = {
  algorithm: "argon2id" as const,
  m: 8192,
  t: 1,
  p: 1,
  version: 1,
};

describe("DEFAULT_KDF_PARAMS", () => {
  it("matches the reviewed decision (m=64MiB, t=2, p=1, version=1)", () => {
    expect(DEFAULT_KDF_PARAMS).toEqual({
      algorithm: "argon2id",
      m: 65536,
      t: 2,
      p: 1,
      version: 1,
    });
  });
});

describe("deriveMasterKey", () => {
  // 已知答案向量（KAT，回归锁定用）：固定输入 + DEFAULT_KDF_PARAMS，硬编码完整 64B
  // argon2id 输出，钉住 KEK/V 拆分方向（前 32B=KEK，后 32B=V）与 hash-wasm 输出稳定。
  // 生成方式：用当前 deriveMasterKey 实现对固定输入（password="kdf-known-answer-vector",
  // salt=0x00..0x1f）跑一次取输出 hex，人工核对拆分逻辑与实施方案 2.1 节一致后硬编码于此。
  // 注意：这条测试只保证实现不漂移，不构成跨实现密码学验证。
  // 生成日期：2026-09-01，hash-wasm 4.12.0，DEFAULT_KDF_PARAMS（argon2id, m=65536, t=2, p=1）。
  const KAT_PASSWORD = "kdf-known-answer-vector";
  const KAT_SALT = Uint8Array.from({ length: 32 }, (_, i) => i); // 0x00..0x1f
  const KAT_KEK_HEX =
    "dc4359d5d5f5c93aa5178d898e4061532b6e172337f84a7eefcde4fa26ce7ccb";
  const KAT_VERIFIER_HEX =
    "ab602b4d638ffdce5b2d789878062665a082a610f4af7ccd63045922c363acb0";

  it("matches the known-answer vector (pins kek/verifier split and hash-wasm output)", async () => {
    const { kek, verifier } = await deriveMasterKey(
      KAT_PASSWORD,
      KAT_SALT,
      DEFAULT_KDF_PARAMS,
    );

    const toHex = (bytes: Uint8Array) =>
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    // 拆分方向：前 32B = KEK，后 32B = V（若实现交换两段或拆分点漂移，此断言即失败）
    expect(toHex(kek)).toBe(KAT_KEK_HEX);
    expect(toHex(verifier)).toBe(KAT_VERIFIER_HEX);
  });

  it("returns 32-byte kek and 32-byte verifier (64-byte argon2id output split in half)", async () => {
    const salt = randomBytes(SALT_LENGTH);
    const { kek, verifier } = await deriveMasterKey(
      "master-password",
      salt,
      FAST_PARAMS,
    );

    expect(kek).toBeInstanceOf(Uint8Array);
    expect(verifier).toBeInstanceOf(Uint8Array);
    expect(kek.length).toBe(KEK_LENGTH);
    expect(verifier.length).toBe(VERIFIER_LENGTH);
    expect(DERIVED_LENGTH).toBe(64);
  });

  it("kek + verifier equals the full deterministic argon2id output", async () => {
    const password = "determinism-check";
    const salt = randomBytes(SALT_LENGTH);

    const first = await deriveMasterKey(password, salt, FAST_PARAMS);
    const second = await deriveMasterKey(password, salt, FAST_PARAMS);

    expect(second.kek).toEqual(first.kek);
    expect(second.verifier).toEqual(first.verifier);
    // 拆分无重叠：两半不相等（概率性，64B 随机碰撞可忽略）
    expect(Array.from(first.kek)).not.toEqual(Array.from(first.verifier));
  });

  it("different salt produces a different kek and verifier", async () => {
    const a = await deriveMasterKey(
      "pwd",
      randomBytes(SALT_LENGTH),
      FAST_PARAMS,
    );
    const b = await deriveMasterKey(
      "pwd",
      randomBytes(SALT_LENGTH),
      FAST_PARAMS,
    );

    expect(a.kek).not.toEqual(b.kek);
    expect(a.verifier).not.toEqual(b.verifier);
  });

  it("different password produces a different kek and verifier", async () => {
    const salt = randomBytes(SALT_LENGTH);
    const a = await deriveMasterKey("pwd-a", salt, FAST_PARAMS);
    const b = await deriveMasterKey("pwd-b", salt, FAST_PARAMS);

    expect(a.kek).not.toEqual(b.kek);
    expect(a.verifier).not.toEqual(b.verifier);
  });

  it("supports unicode passwords", async () => {
    const salt = randomBytes(SALT_LENGTH);
    const a = await deriveMasterKey("主密码🔐", salt, FAST_PARAMS);
    const b = await deriveMasterKey("主密码🔐", salt, FAST_PARAMS);

    expect(a.kek).toEqual(b.kek);
    expect(a.verifier).toEqual(b.verifier);
  });

  it("rejects an empty salt", async () => {
    await expect(
      deriveMasterKey("pwd", new Uint8Array(), FAST_PARAMS),
    ).rejects.toThrow(/salt/);
  });

  it("rejects a too-short salt", async () => {
    await expect(
      deriveMasterKey("pwd", randomBytes(4), FAST_PARAMS),
    ).rejects.toThrow(/salt/);
  });

  it("works with the default params (64MiB / t=2 / p=1)", async () => {
    const salt = randomBytes(SALT_LENGTH);
    const { kek, verifier } = await deriveMasterKey("default-params-pwd", salt);

    expect(kek.length).toBe(KEK_LENGTH);
    expect(verifier.length).toBe(VERIFIER_LENGTH);
  });
});
