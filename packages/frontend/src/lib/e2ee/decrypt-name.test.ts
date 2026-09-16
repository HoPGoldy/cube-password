import { describe, expect, it } from "vitest";
import { decryptContent, encryptContent } from "./cipher";
import {
  NAME_DECRYPT_FAILED,
  decryptName,
  decryptNameForList,
} from "./decrypt-name";
import { randomBytes } from "./random";

describe("decryptName", () => {
  it("returns empty string when nameEnc is empty", async () => {
    expect(await decryptName(randomBytes(32), "")).toBe("");
  });

  it("round-trips a ciphertext produced by encryptContent", async () => {
    const dek = randomBytes(32);
    const nameEnc = await encryptContent(dek, "GitHub");
    expect(await decryptName(dek, nameEnc)).toBe("GitHub");
    expect(await decryptName(dek, nameEnc)).toBe(
      await decryptContent(dek, nameEnc),
    );
  });

  it("throws when the ciphertext is tampered", async () => {
    const dek = randomBytes(32);
    const nameEnc = await encryptContent(dek, "GitHub");
    const parts = nameEnc.split(":");
    const tag = parts[4];
    parts[4] = (tag[0] === "0" ? "1" : "0") + tag.slice(1);
    await expect(decryptName(dek, parts.join(":"))).rejects.toThrow();
  });
});

describe("decryptNameForList", () => {
  it("returns the placeholder when dek is missing", async () => {
    expect(await decryptNameForList(undefined, "v2:aes-256-gcm:x")).toBe(
      NAME_DECRYPT_FAILED,
    );
  });

  it("returns the placeholder when nameEnc is empty", async () => {
    expect(await decryptNameForList(randomBytes(32), "")).toBe(
      NAME_DECRYPT_FAILED,
    );
  });

  it("returns plaintext for a valid nameEnc", async () => {
    const dek = randomBytes(32);
    const nameEnc = await encryptContent(dek, "招商银行");
    expect(await decryptNameForList(dek, nameEnc)).toBe("招商银行");
  });

  it("returns the placeholder when decryption fails", async () => {
    const dek = randomBytes(32);
    const nameEnc = await encryptContent(dek, "secret");
    expect(await decryptNameForList(randomBytes(32), nameEnc)).toBe(
      NAME_DECRYPT_FAILED,
    );
  });
});
