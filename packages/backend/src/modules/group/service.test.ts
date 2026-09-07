import { describe, expect, it } from "vitest";
import { GroupService } from "@/modules/group/service";
import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
/**
 * 构造仅覆盖 unlock Password 分支所需字段的最小分组记录
 * （service 内 unlock 只读这些字段，Prisma 行为不在单测范围内）
 */
const makeGroup = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  name: "g",
  order: 0,
  lockType: "Password",
  passwordHash: "A".repeat(64), // hex(V)
  passwordSalt: "B".repeat(64),
  keyBlob: null,
  kdfParams: "",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/** 用真实实现 + 查询桩组装 GroupService（unlock 只调用 prisma.group.findUnique） */
const makeService = (
  group: ReturnType<typeof makeGroup>,
  sessionManager = new SessionManager(),
  challengeManager = new ChallengeManager(),
) => {
  const service = new GroupService({
    prisma: {
      group: { findUnique: async () => group },
    } as never,
    sessionManager,
    challengeManager,
  });
  return service;
};

describe("GroupService.unlock - Password 锁 kdfParams 校验", () => {
  it("kdfParams 为空串（v1 遗留）时抛明确的重新设置错误", async () => {
    const challengeManager = new ChallengeManager();
    challengeManager.generateChallenge();
    const service = new GroupService({
      prisma: {
        group: { findUnique: async () => makeGroup({ kdfParams: "" }) },
      } as never,
      sessionManager: new SessionManager(),
      challengeManager,
    });

    await expect(service.unlock(1, { hash: "X".repeat(128) })).rejects.toThrow(
      "旧版锁密码，请重新设置分组锁密码",
    );
  });

  it("kdfParams 非法（JSON 坏 / algorithm 不识别 / 字段缺失）时拒绝解锁", async () => {
    const badParamsList = [
      "{not-json",
      JSON.stringify({ algorithm: "pbkdf2", m: 65536, t: 2, p: 1, version: 1 }),
      JSON.stringify({ algorithm: "argon2id", t: 2, p: 1 }), // 缺 m
      JSON.stringify({
        algorithm: "argon2id",
        m: "65536",
        t: 2,
        p: 1,
        version: 1,
      }),
      JSON.stringify({
        algorithm: "argon2id",
        m: 65536,
        t: 2,
        p: 1,
        version: "1",
      }),
    ];

    for (const kdfParams of badParamsList) {
      const challengeManager = new ChallengeManager();
      challengeManager.generateChallenge();
      const service = new GroupService({
        prisma: {
          group: { findUnique: async () => makeGroup({ kdfParams }) },
        } as never,
        sessionManager: new SessionManager(),
        challengeManager,
      });
      await expect(
        service.unlock(1, { hash: "X".repeat(128) }),
      ).rejects.toThrow(/请重新设置分组锁密码/);
    }
  });

  it("合法 kdfParams 时 hash 正确则解锁成功（比对 sha512(hex(V)+challenge)）", async () => {
    const { createHash } = await import("node:crypto");
    const sessionManager = new SessionManager();
    sessionManager.createSession();
    const challengeManager = new ChallengeManager();
    const verifier = "C".repeat(64); // hex(V)
    const svc = makeService(
      makeGroup({
        passwordHash: verifier,
        kdfParams: JSON.stringify({
          algorithm: "argon2id",
          m: 65536,
          t: 2,
          p: 1,
          version: 1,
        }),
      }),
      sessionManager,
      challengeManager,
    );

    // 解锁前先生成挑战码（服务端 pop 最新）
    const challengeCode = challengeManager.generateChallenge();
    const hash = createHash("sha512")
      .update(verifier + challengeCode)
      .digest("hex")
      .toUpperCase();

    await expect(svc.unlock(1, { hash })).resolves.toBeUndefined();
    expect(sessionManager.isGroupUnlocked(1)).toBe(true);
  });

  it("合法 kdfParams 但 hash 错误时解锁失败（ErrorGroupUnlockFailed）", async () => {
    const sessionManager = new SessionManager();
    sessionManager.createSession();
    const challengeManager = new ChallengeManager();
    const svc = makeService(
      makeGroup({
        kdfParams: JSON.stringify({
          algorithm: "argon2id",
          m: 65536,
          t: 2,
          p: 1,
          version: 1,
        }),
      }),
      sessionManager,
      challengeManager,
    );
    challengeManager.generateChallenge();

    // hash 错误（sha512 只输出 128 hex 字符，这里用不匹配的值）
    await expect(svc.unlock(1, { hash: "X".repeat(128) })).rejects.toThrow(
      "分组解锁失败",
    );
    expect(sessionManager.isGroupUnlocked(1)).toBe(false);
  });

  it("lockType 为未知值（如 banana）的存量脏数据时抛错不放行", async () => {
    const sessionManager = new SessionManager();
    sessionManager.createSession();
    const challengeManager = new ChallengeManager();
    const svc = makeService(
      makeGroup({ lockType: "banana" }),
      sessionManager,
      challengeManager,
    );

    // 即使携带了合法格式的 hash 也不得放行（禁止 fall-through 到 addUnlockedGroup）
    await expect(svc.unlock(1, { hash: "X".repeat(128) })).rejects.toThrow(
      "未知的分组锁类型: banana",
    );
    expect(sessionManager.isGroupUnlocked(1)).toBe(false);
  });

  it("lockType 为未知值且不带任何凭证时同样抛错不放行", async () => {
    const sessionManager = new SessionManager();
    sessionManager.createSession();
    const svc = makeService(
      makeGroup({ lockType: "banana" }),
      sessionManager,
      new ChallengeManager(),
    );

    await expect(svc.unlock(1, {})).rejects.toThrow("未知的分组锁类型");
    expect(sessionManager.isGroupUnlocked(1)).toBe(false);
  });

  it("lockType=None 时直接解锁成功（确认 else 分支未影响 None 路径）", async () => {
    const sessionManager = new SessionManager();
    sessionManager.createSession();
    const svc = makeService(
      makeGroup({ lockType: "None" }),
      sessionManager,
      new ChallengeManager(),
    );

    await expect(svc.unlock(1, {})).resolves.toBeUndefined();
    expect(sessionManager.isGroupUnlocked(1)).toBe(true);
  });
});
