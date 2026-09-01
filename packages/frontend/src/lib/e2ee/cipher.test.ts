import { describe, expect, it } from "vitest";
import {
  ErrorDecryptionFailed,
  ErrorUnsupportedDekVersion,
  decryptContent,
  encryptContent,
  unwrapDek,
  wrapDek,
} from "./cipher";
import { randomBytes } from "./random";
import { DEFAULT_KDF_PARAMS, deriveMasterKey } from "./kdf";
import { V2_ALG_AES_256_GCM, buildV2, hexToBytes } from "./format";

/** 手工构造指定版本头的 keyBlob（用于测试 unwrapDek 的版本校验） */
const buildKeyBlobWithVersion = async (
  kek: Uint8Array,
  version: number,
  dek: Uint8Array,
): Promise<string> => {
  const plaintext = new Uint8Array(1 + dek.length);
  plaintext[0] = version;
  plaintext.set(dek, 1);

  const nonce = randomBytes(12);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    kek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
      cryptoKey,
      plaintext as BufferSource,
    ),
  );
  return buildV2(
    V2_ALG_AES_256_GCM,
    nonce,
    encrypted.slice(0, encrypted.length - 16),
    encrypted.slice(encrypted.length - 16),
  );
};

const SAMPLE_PLAINTEXTS = [
  "hello world",
  "",
  "p@ssw0rd with ünïcode 中文 🎉",
  "x".repeat(1000),
];

describe("content round-trip", () => {
  it("encryptContent -> decryptContent restores the original plaintext", async () => {
    const dek = randomBytes(32);
    for (const plaintext of SAMPLE_PLAINTEXTS) {
      const encrypted = await encryptContent(dek, plaintext);
      expect(await decryptContent(dek, encrypted)).toBe(plaintext);
    }
  });
});

describe("v2 output format", () => {
  it("outputs `v2:aes-256-gcm:<nonce>:<ciphertext>:<tag>` with correct lengths", async () => {
    const dek = randomBytes(32);
    const encrypted = await encryptContent(dek, "some secret");

    expect(encrypted).toMatch(/^v2:aes-256-gcm:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

    const [, , nonceHex, ciphertextHex, tagHex] = encrypted.split(":");
    expect(nonceHex).toHaveLength(24); // 96-bit nonce
    expect(tagHex).toHaveLength(32); // 128-bit tag
    expect(ciphertextHex).toHaveLength("some secret".length * 2); // GCM 无填充，hex 每 2 字符表示 1 字节
  });

  it("uses a random nonce each time (same plaintext -> different ciphertext)", async () => {
    const dek = randomBytes(32);
    const a = await encryptContent(dek, "same plaintext");
    const b = await encryptContent(dek, "same plaintext");

    expect(a).not.toBe(b);
    // nonce 不同但明文长度一致
    const nonceA = a.split(":")[2];
    const nonceB = b.split(":")[2];
    expect(nonceA).not.toBe(nonceB);
    // GCM 为 CTR 模式：nonce 不同则 keystream 不同，密文必然不同
    expect(a.split(":")[3]).not.toBe(b.split(":")[3]);

    // 各自都能解回原文
    expect(await decryptContent(dek, a)).toBe("same plaintext");
    expect(await decryptContent(dek, b)).toBe("same plaintext");
  });
});

describe("AEAD tamper detection", () => {
  const dek = randomBytes(32);
  const tamperCases = [
    {
      name: "flips a ciphertext hex char",
      mutate: (v: string) => {
        const p = v.split(":");
        const c = p[3];
        p[3] = (c[0] === "0" ? "1" : "0") + c.slice(1);
        return p.join(":");
      },
    },
    {
      name: "flips a tag hex char",
      mutate: (v: string) => {
        const p = v.split(":");
        const t = p[4];
        p[4] = (t[0] === "0" ? "1" : "0") + t.slice(1);
        return p.join(":");
      },
    },
    {
      name: "flips a nonce hex char",
      mutate: (v: string) => {
        const p = v.split(":");
        const n = p[2];
        p[2] = (n[0] === "0" ? "1" : "0") + n.slice(1);
        return p.join(":");
      },
    },
    {
      name: "truncates the tag",
      mutate: (v: string) => {
        const p = v.split(":");
        p[4] = p[4].slice(0, 30);
        return p.join(":");
      },
    },
  ];

  for (const { name, mutate } of tamperCases) {
    it(`decryptContent throws when it ${name}`, async () => {
      const encrypted = await encryptContent(dek, "integrity check");
      await expect(decryptContent(dek, mutate(encrypted))).rejects.toThrow();
    });
  }

  it("decryptContent throws with the wrong key", async () => {
    const encrypted = await encryptContent(dek, "integrity check");
    await expect(decryptContent(randomBytes(32), encrypted)).rejects.toThrow(
      ErrorDecryptionFailed,
    );
  });

  it("unwrapDek throws when the keyBlob is tampered", async () => {
    const kek = randomBytes(32);
    const keyBlob = await wrapDek(kek, randomBytes(32));
    const parts = keyBlob.split(":");
    const c = parts[3];
    parts[3] = (c[0] === "0" ? "1" : "0") + c.slice(1);
    await expect(unwrapDek(kek, parts.join(":"))).rejects.toThrow(
      ErrorDecryptionFailed,
    );
  });

  it("unwrapDek throws with the wrong KEK (i.e. wrong master password)", async () => {
    const keyBlob = await wrapDek(randomBytes(32), randomBytes(32));
    await expect(unwrapDek(randomBytes(32), keyBlob)).rejects.toThrow(
      ErrorDecryptionFailed,
    );
  });
});

describe("wrapDek / unwrapDek", () => {
  it("round-trips: unwrapDek(kek, wrapDek(kek, dek)) equals the original dek", async () => {
    const kek = randomBytes(32);
    const dek = randomBytes(32);

    const keyBlob = await wrapDek(kek, dek);
    expect(await unwrapDek(kek, keyBlob)).toEqual(dek);
  });

  it("keyBlob uses the v2 format", async () => {
    const keyBlob = await wrapDek(randomBytes(32), randomBytes(32));
    expect(keyBlob).toMatch(
      /^v2:aes-256-gcm:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$/,
    );
  });

  it("wrapping the same dek twice produces different keyBlobs (random nonce)", async () => {
    const kek = randomBytes(32);
    const dek = randomBytes(32);

    expect(await wrapDek(kek, dek)).not.toBe(await wrapDek(kek, dek));
  });

  it("wrapped dek differs from the plaintext dek", async () => {
    const kek = randomBytes(32);
    const dek = randomBytes(32);
    const keyBlob = await wrapDek(kek, dek);

    const keyBlobHex = keyBlob.split(":")[3] + keyBlob.split(":")[4];
    const dekHex = Buffer.from(dek).toString("hex");
    expect(keyBlobHex).not.toContain(dekHex);
  });

  it("end-to-end: derived KEK wraps and unwraps a DEK", async () => {
    const salt = randomBytes(32);
    const { kek } = await deriveMasterKey("master-password", salt, {
      algorithm: "argon2id",
      m: 8192,
      t: 1,
      p: 1,
      version: 1,
    });
    const dek = randomBytes(32);

    const keyBlob = await wrapDek(kek, dek);
    expect(await unwrapDek(kek, keyBlob)).toEqual(dek);
  });

  it("rejects a dek of the wrong length", async () => {
    const kek = randomBytes(32);
    await expect(wrapDek(kek, randomBytes(16))).rejects.toThrow(/32-byte/);
    await expect(wrapDek(kek, new Uint8Array(0))).rejects.toThrow();
  });

  it("unwrapDek throws ErrorUnsupportedDekVersion when the version header is unknown", async () => {
    const kek = randomBytes(32);
    const dek = randomBytes(32);

    // 未来版本号的 keyBlob：AEAD 可正常解开，但版本头不被当前代码支持
    const futureBlob = await buildKeyBlobWithVersion(kek, 2, dek);
    await expect(unwrapDek(kek, futureBlob)).rejects.toThrow(
      ErrorUnsupportedDekVersion,
    );

    // 版本 0 同样不支持（版本号从 1 开始）
    const zeroBlob = await buildKeyBlobWithVersion(kek, 0, dek);
    await expect(unwrapDek(kek, zeroBlob)).rejects.toThrow(
      ErrorUnsupportedDekVersion,
    );
  });

  it("unwrapDek accepts the current version header and returns the dek", async () => {
    const kek = randomBytes(32);
    const dek = randomBytes(32);

    const blob = await buildKeyBlobWithVersion(kek, 1, dek);
    expect(await unwrapDek(kek, blob)).toEqual(dek);
  });
});

describe("cross-check with DEFAULT_KDF_PARAMS shape", () => {
  it("kdfParams versioning: deriveMasterKey honors custom params", async () => {
    const salt = randomBytes(32);
    const custom = { ...DEFAULT_KDF_PARAMS, m: 8192, t: 3 };
    const a = await deriveMasterKey("params-check", salt, custom);
    const b = await deriveMasterKey("params-check", salt, DEFAULT_KDF_PARAMS);

    expect(a.kek).not.toEqual(b.kek);
  });
});

describe("hex round-trip helper", () => {
  it("hexToBytes decodes lowercase hex used by the v2 format", () => {
    expect(hexToBytes("00ff10")).toEqual(new Uint8Array([0x00, 0xff, 0x10]));
  });
});
