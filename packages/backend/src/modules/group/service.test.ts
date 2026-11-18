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

/**
 * 删除分组的桩：只实现 deleteGroup 用到的查询/事务接口
 * （Prisma 行为不在单测范围内，这里验证的是业务规则：保留至少一个分组、
 * 删除默认分组时把 defaultGroupId 切到剩余第一个分组）。
 */
const makeDeleteService = (options: {
  groups: { id: number; name: string; order: number }[];
  user: { id: number; defaultGroupId: number } | null;
}) => {
  let groups = [...options.groups];
  const removedIds: number[] = [];
  const userUpdates: { defaultGroupId: number }[] = [];

  const tx = {
    group: {
      delete: async ({ where }: { where: { id: number } }) => {
        removedIds.push(where.id);
        groups = groups.filter((g) => g.id !== where.id);
      },
      findFirst: async () => {
        const sorted = [...groups].sort(
          (a, b) => a.order - b.order || a.id - b.id,
        );
        return sorted[0] ?? null;
      },
    },
    user: {
      findFirst: async () => options.user,
      update: async ({ data }: { data: { defaultGroupId: number } }) => {
        userUpdates.push(data);
        if (options.user) options.user.defaultGroupId = data.defaultGroupId;
      },
    },
  };

  const prisma = {
    group: {
      findUnique: async ({ where }: { where: { id: number } }) =>
        groups.find((g) => g.id === where.id) ?? null,
      count: async () => groups.length,
    },
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> =>
      fn(tx),
  };

  const service = new GroupService({
    prisma: prisma as never,
    sessionManager: new SessionManager(),
    challengeManager: new ChallengeManager(),
  });

  return { service, removedIds, userUpdates };
};

describe("GroupService.deleteGroup - 删除分组", () => {
  it("删除非默认分组：返回当前默认分组，不改动用户配置", async () => {
    const { service, removedIds, userUpdates } = makeDeleteService({
      groups: [
        { id: 1, name: "默认分组", order: 0 },
        { id: 2, name: "测试分组", order: 1 },
      ],
      user: { id: 1, defaultGroupId: 1 },
    });

    await expect(service.deleteGroup(2)).resolves.toEqual({
      defaultGroupId: 1,
    });
    expect(removedIds).toEqual([2]);
    expect(userUpdates).toEqual([]);
  });

  it("删除默认分组：defaultGroupId 切到剩余分组中 order 最小的一个", async () => {
    const { service, removedIds, userUpdates } = makeDeleteService({
      groups: [
        { id: 1, name: "默认分组", order: 0 },
        { id: 3, name: "后创建的分组", order: 5 },
        { id: 2, name: "排序靠前的分组", order: 2 },
      ],
      user: { id: 1, defaultGroupId: 1 },
    });

    await expect(service.deleteGroup(1)).resolves.toEqual({
      defaultGroupId: 2,
    });
    expect(removedIds).toEqual([1]);
    expect(userUpdates).toEqual([{ defaultGroupId: 2 }]);
  });

  it("只剩一个分组时拒绝删除（锁定分组同样受此限制）", async () => {
    const { service, removedIds } = makeDeleteService({
      groups: [{ id: 1, name: "唯一分组", order: 0 }],
      user: { id: 1, defaultGroupId: 1 },
    });

    await expect(service.deleteGroup(1)).rejects.toThrow(
      "至少保留一个分组，无法删除",
    );
    expect(removedIds).toEqual([]);
  });

  it("分组不存在时报「分组不存在」", async () => {
    const { service } = makeDeleteService({
      groups: [
        { id: 1, name: "默认分组", order: 0 },
        { id: 2, name: "测试分组", order: 1 },
      ],
      user: { id: 1, defaultGroupId: 1 },
    });

    await expect(service.deleteGroup(99)).rejects.toThrow("分组不存在");
  });
});
