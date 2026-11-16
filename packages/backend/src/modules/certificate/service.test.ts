import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "@/lib/session";
import { CertificateService } from "./service";

const makeService = (firstOrder: number | null) => {
  const findFirst = vi.fn(async () =>
    firstOrder === null ? null : { order: firstOrder },
  );
  const create = vi.fn(async (args: { data: { order: number } }) => {
    if (firstOrder === null || args.data.order < firstOrder) {
      firstOrder = args.data.order;
    }
    return { id: 1 };
  });
  const transactionClient = { certificate: { findFirst, create } };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        await callback(transactionClient),
    ),
  };
  const sessionManager = new SessionManager();
  sessionManager.createSession();
  sessionManager.addUnlockedGroup(7);

  const service = new CertificateService({
    prisma: prisma as never,
    sessionManager,
  });

  return { service, findFirst, create };
};

describe("CertificateService.add - 新凭证排序", () => {
  it("空分组的首个凭证使用 order -1", async () => {
    const { service, create } = makeService(null);

    await service.add({ groupId: 7 });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ groupId: 7, order: -1 }),
    });
  });

  it("默认排在当前最小 order 之前，连续新建也保持最新在前", async () => {
    const { service, findFirst, create } = makeService(-1);

    await service.add({ groupId: 7 });
    await service.add({ groupId: 7 });

    expect(findFirst).toHaveBeenCalledWith({
      where: { groupId: 7 },
      orderBy: { order: "asc" },
      select: { order: true },
    });
    expect(create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ groupId: 7, order: -2 }),
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ groupId: 7, order: -3 }),
    });
  });

  it("显式传入 order 时保持兼容，不自动改序", async () => {
    const { service, findFirst, create } = makeService(-1);

    await service.add({ groupId: 7, order: 8 });

    expect(findFirst).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ groupId: 7, order: 8 }),
    });
  });
});
