import { PrismaService } from "@/modules/prisma";
import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { sha512 } from "@/lib/crypto";
import { authenticator } from "otplib";
import { ErrorGroupNotFound, ErrorGroupUnlockFailed } from "./error";

interface GroupServiceDeps {
  prisma: PrismaService;
  sessionManager: SessionManager;
  challengeManager: ChallengeManager;
}

export class GroupService {
  private prisma: PrismaService;
  private sessionManager: SessionManager;
  private challengeManager: ChallengeManager;

  constructor(deps: GroupServiceDeps) {
    this.prisma = deps.prisma;
    this.sessionManager = deps.sessionManager;
    this.challengeManager = deps.challengeManager;
  }

  async addGroup(data: {
    name: string;
    lockType?: string;
    passwordHash?: string;
  }) {
    const maxOrder = await this.prisma.group.aggregate({
      _max: { order: true },
    });
    const newGroup = await this.prisma.group.create({
      data: {
        name: data.name,
        lockType: data.lockType ?? "None",
        passwordHash: data.passwordHash,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    if (data.lockType === "None" || !data.lockType) {
      this.sessionManager.addUnlockedGroup(newGroup.id);
    }

    const newList = await this.listGroups();
    return { newId: newGroup.id, newList: newList.items };
  }

  async listGroups() {
    const groups = await this.prisma.group.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { certificates: true } } },
    });

    return {
      items: groups.map((g) => ({
        id: g.id,
        name: g.name,
        lockType: g.lockType,
        certificateCount: g._count.certificates,
        order: g.order,
      })),
    };
  }

  async updateName(id: number, name: string): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new ErrorGroupNotFound();
    await this.prisma.group.update({ where: { id }, data: { name } });
  }

  async updateConfig(
    id: number,
    lockType: string,
    passwordHash?: string,
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new ErrorGroupNotFound();
    await this.prisma.group.update({
      where: { id },
      data: { lockType, passwordHash: passwordHash ?? null },
    });
  }

  async unlock(
    id: number,
    options: {
      hash?: string;
      challengeCode?: string;
      totpCode?: string;
    },
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new ErrorGroupNotFound();

    if (group.lockType === "None") {
      this.sessionManager.addUnlockedGroup(id);
      return;
    }

    if (group.lockType === "Password") {
      if (!options.hash || !options.challengeCode) {
        throw new ErrorGroupUnlockFailed();
      }
      if (!this.challengeManager.validateChallenge(options.challengeCode)) {
        throw new ErrorGroupUnlockFailed();
      }
      if (!group.passwordHash) throw new ErrorGroupUnlockFailed();

      const expectedHash = sha512(group.passwordHash + options.challengeCode);
      if (options.hash !== expectedHash) {
        throw new ErrorGroupUnlockFailed();
      }
    }

    if (group.lockType === "Totp") {
      if (!options.totpCode) throw new ErrorGroupUnlockFailed();

      const user = await this.prisma.user.findFirst();
      if (!user?.totpSecret) throw new ErrorGroupUnlockFailed();

      const isValid = authenticator.verify({
        token: options.totpCode,
        secret: user.totpSecret,
      });
      if (!isValid) throw new ErrorGroupUnlockFailed();
    }

    this.sessionManager.addUnlockedGroup(id);
  }

  async deleteGroup(id: number): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new ErrorGroupNotFound();
    await this.prisma.group.delete({ where: { id } });
  }

  async sort(ids: number[]): Promise<void> {
    await Promise.all(
      ids.map((id, index) =>
        this.prisma.group.update({ where: { id }, data: { order: index } }),
      ),
    );
  }

  async setDefault(id: number): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { defaultGroupId: id },
    });
  }
}
