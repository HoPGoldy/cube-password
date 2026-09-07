import { PrismaService } from "@/modules/prisma";
import { SessionManager } from "@/lib/session";
import { ChallengeManager } from "@/lib/challenge";
import { sha512, timingSafeEqual } from "@/lib/crypto";
import { parseKdfParams } from "@cube-password/shared/kdf-params";
import { verifySync } from "otplib";
import { ErrorBadRequest } from "@/types/error";
import {
  ErrorGroupLockTypeUnknown,
  ErrorGroupNotFound,
  ErrorGroupUnlockFailed,
} from "./error";

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
    passwordSalt?: string;
    kdfParams?: string;
  }) {
    const maxOrder = await this.prisma.group.aggregate({
      _max: { order: true },
    });
    const newGroup = await this.prisma.group.create({
      data: {
        name: data.name,
        lockType: data.lockType ?? "None",
        passwordHash: data.passwordHash,
        passwordSalt: data.passwordSalt,
        kdfParams: data.kdfParams ?? "",
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    if (data.lockType === "None" || !data.lockType) {
      this.sessionManager.addUnlockedGroup(newGroup.id);
    }

    return { newId: newGroup.id };
  }

  /** 列表单项 → 下发结构（Password 锁下发 salt + kdfParams，解锁派生用） */
  private toListItem(g: {
    id: number;
    name: string;
    lockType: string;
    order: number;
    passwordSalt: string | null;
    kdfParams: string;
    _count: { certificates: number };
  }) {
    return {
      id: g.id,
      name: g.name,
      lockType: g.lockType,
      certificateCount: g._count.certificates,
      order: g.order,
      salt: g.passwordSalt || undefined,
      kdfParams: g.kdfParams || undefined,
    };
  }

  async listGroups() {
    const groups = await this.prisma.group.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { certificates: true } } },
    });

    return { items: groups.map((g) => this.toListItem(g)) };
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
    passwordSalt?: string,
    kdfParams?: string,
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new ErrorGroupNotFound();
    await this.prisma.group.update({
      where: { id },
      data: {
        lockType,
        passwordHash: passwordHash ?? null,
        passwordSalt: passwordSalt ?? null,
        kdfParams: kdfParams ?? "",
      },
    });

    // 设锁立即生效：从当前 session 解锁集移除（变 None 则无需处理，登录即解锁）
    if (lockType !== "None") {
      this.sessionManager.removeUnlockedGroup(id);
    }
  }

  async unlock(
    id: number,
    options: {
      hash?: string;
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
      if (!options.hash) {
        throw new ErrorGroupUnlockFailed();
      }
      const challengeCode = this.challengeManager.popLastChallenge();
      if (!challengeCode) {
        throw new ErrorGroupUnlockFailed();
      }
      if (!group.passwordHash) throw new ErrorGroupUnlockFailed();

      // 旧格式判定：kdfParams 为空串即 v1 遗留（sha512(salt+pwd)），
      // 无法在此校验，显式报错引导重新设置（正式升级走 T05 迁移脚本）
      if (!group.kdfParams) {
        throw new ErrorBadRequest("旧版锁密码，请重新设置分组锁密码");
      }

      // 参数非法同样视为不可用的旧数据，拒绝解锁（禁止静默回落默认值，
      // 否则会派生出与库内 V 不一致的密钥）
      try {
        parseKdfParams(group.kdfParams);
      } catch (err) {
        throw new ErrorBadRequest(
          `分组锁密码参数非法，请重新设置分组锁密码（${
            err instanceof Error ? err.message : String(err)
          }）`,
        );
      }

      // hash = SHA512(hex(V) + challenge)，V = argon2id(password, salt, kdfParams)
      // 输出后 32 字节，派生由前端完成，服务端只比对
      const expectedHash = sha512(group.passwordHash + challengeCode);
      if (!timingSafeEqual(options.hash, expectedHash)) {
        throw new ErrorGroupUnlockFailed();
      }
    }

    if (group.lockType === "Totp") {
      if (!options.totpCode) throw new ErrorGroupUnlockFailed();

      const user = await this.prisma.user.findFirst();
      if (!user?.totpSecret) throw new ErrorGroupUnlockFailed();

      const isValid = verifySync({
        token: options.totpCode,
        secret: user.totpSecret,
      }).valid;
      if (!isValid) throw new ErrorGroupUnlockFailed();
    } else if (group.lockType !== "Password") {
      // 存量脏数据可能存在未知 lockType：必须报错而不是静默放行，
      // 否则非法锁类型等同于一碰就开的假锁
      throw new ErrorGroupLockTypeUnknown(group.lockType);
    }

    this.sessionManager.addUnlockedGroup(id);
  }

  async deleteGroup(id: number): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new ErrorGroupNotFound();
    await this.prisma.group.delete({ where: { id } });
  }

  async sort(ids: number[]): Promise<void> {
    await this.prisma.$transaction(
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
