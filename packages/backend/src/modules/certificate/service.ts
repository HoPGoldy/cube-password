import { PrismaService } from "@/modules/prisma";
import { SessionManager } from "@/lib/session";
import { ErrorBadRequest, ErrorForbidden, ErrorNotFound } from "@/types/error";

interface CertificateServiceDeps {
  prisma: PrismaService;
  sessionManager: SessionManager;
}

export class CertificateService {
  /** migrate-metadata 单批条数上限 */
  private static MIGRATE_METADATA_BATCH_LIMIT = 100;

  private prisma: PrismaService;
  private sessionManager: SessionManager;

  constructor(deps: CertificateServiceDeps) {
    this.prisma = deps.prisma;
    this.sessionManager = deps.sessionManager;
  }

  /** 写操作门禁：逐一校验涉及的分组均已解锁，任一未解锁则整体拒绝 */
  private assertGroupsUnlocked(groupIds: number[]) {
    for (const groupId of Array.from(new Set(groupIds))) {
      if (!this.sessionManager.isGroupUnlocked(groupId)) {
        throw new ErrorForbidden("分组未解锁");
      }
    }
  }

  async listByGroup(groupId: number) {
    if (!this.sessionManager.isGroupUnlocked(groupId)) {
      throw new ErrorForbidden("分组未解锁");
    }

    const items = await this.prisma.certificate.findMany({
      where: { groupId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        nameEnc: true,
        markColor: true,
        icon: true,
        updatedAt: true,
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * 全量凭证索引（元数据加密）：仅返回索引字段（不含 name/content），
   * 供前端用 DEK 解密 nameEnc 构建内存明文索引。限可达分组（登录即解锁的组），
   * 锁定分组的凭证不可见，其名称本就不可读。
   */
  async listAll() {
    const groupIds = this.sessionManager.getUnlockedGroupIds();
    if (groupIds.length === 0) return { items: [] };

    const items = await this.prisma.certificate.findMany({
      where: { groupId: { in: groupIds } },
      orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        nameEnc: true,
        icon: true,
        markColor: true,
        updatedAt: true,
        groupId: true,
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async add(data: {
    name?: string;
    nameEnc?: string;
    groupId: number;
    content?: string;
    markColor?: string;
    icon?: string;
    order?: number;
  }) {
    // 写门禁：目标分组必须已解锁
    this.assertGroupsUnlocked([data.groupId]);

    const cert = await this.prisma.certificate.create({
      data: {
        // 旧明文列停止业务写入（迁移期只读）；新数据仅写 nameEnc
        name: data.name ?? "",
        nameEnc: data.nameEnc ?? "",
        groupId: data.groupId,
        content: data.content ?? "",
        markColor: data.markColor,
        icon: data.icon,
        order: data.order ?? -1,
      },
    });
    return { id: cert.id };
  }

  async detail(id: number) {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert) throw new ErrorNotFound("凭证不存在");

    // 检查分组是否已解锁
    if (!this.sessionManager.isGroupUnlocked(cert.groupId)) {
      throw new ErrorForbidden("分组未解锁");
    }

    return {
      id: cert.id,
      name: cert.name,
      nameEnc: cert.nameEnc,
      groupId: cert.groupId,
      content: cert.content,
      markColor: cert.markColor,
      icon: cert.icon,
      createdAt: cert.createdAt.toISOString(),
      updatedAt: cert.updatedAt.toISOString(),
    };
  }

  async update(data: {
    id: number;
    name?: string;
    nameEnc?: string;
    groupId: number;
    content?: string;
    markColor?: string | null;
    icon?: string | null;
    order?: number;
  }) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: data.id },
    });
    if (!cert) throw new ErrorNotFound("凭证不存在");

    // 写门禁：来源分组（凭证当前所在）与目标分组均须已解锁
    this.assertGroupsUnlocked([cert.groupId, data.groupId]);

    const updateData: Record<string, unknown> = {
      groupId: data.groupId,
    };
    // 旧明文列停止业务写入；仅当请求显式携带 name 时兼容写入（e2e 迁移期）
    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameEnc !== undefined) updateData.nameEnc = data.nameEnc;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.markColor !== undefined) updateData.markColor = data.markColor;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.order !== undefined) updateData.order = data.order;

    await this.prisma.certificate.update({
      where: { id: data.id },
      data: updateData,
    });
    return {};
  }

  async delete(ids: number[]): Promise<void> {
    // 写门禁：逐一校验被删凭证所在分组均已解锁
    const certs = await this.prisma.certificate.findMany({
      where: { id: { in: ids } },
      select: { groupId: true },
    });
    this.assertGroupsUnlocked(certs.map((cert) => cert.groupId));

    await this.prisma.certificate.deleteMany({ where: { id: { in: ids } } });
  }

  async move(ids: number[], newGroupId: number): Promise<void> {
    // 写门禁：来源分组（凭证当前所在）与目标分组均须已解锁
    const certs = await this.prisma.certificate.findMany({
      where: { id: { in: ids } },
      select: { groupId: true },
    });
    this.assertGroupsUnlocked([
      ...certs.map((cert) => cert.groupId),
      newGroupId,
    ]);

    await this.prisma.certificate.updateMany({
      where: { id: { in: ids } },
      data: { groupId: newGroupId },
    });
  }

  async sort(ids: number[]): Promise<void> {
    // 写门禁：逐一校验涉及凭证所在分组均已解锁
    const certs = await this.prisma.certificate.findMany({
      where: { id: { in: ids } },
      select: { groupId: true },
    });
    this.assertGroupsUnlocked(certs.map((cert) => cert.groupId));

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.certificate.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  /**
   * 元数据迁移：单事务内批量写入凭证名称密文；finish=true 时同一事务内
   * 收尾写 metadataVersion=2。任一条目失败则整批回滚（含 metadataVersion）。
   */
  async migrateMetadata(data: {
    items: { id: number; nameEnc: string }[];
    finish?: boolean;
  }) {
    if (data.items.length > CertificateService.MIGRATE_METADATA_BATCH_LIMIT) {
      throw new ErrorBadRequest(
        `单批最多 ${CertificateService.MIGRATE_METADATA_BATCH_LIMIT} 条`,
      );
    }
    if (data.items.length === 0 && !data.finish) {
      throw new ErrorBadRequest("items 不能为空");
    }

    // 写门禁：迁移是写操作，与 add/update/delete/move/sort 同构 —— 涉及分组
    // 必须已解锁（锁定分组的明文名本就不可读，前端迁移流程应先解锁全部分组）
    if (data.items.length > 0) {
      const certs = await this.prisma.certificate.findMany({
        where: { id: { in: data.items.map((item) => item.id) } },
        select: { groupId: true },
      });
      this.assertGroupsUnlocked(certs.map((cert) => cert.groupId));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const item of data.items) {
        const result = await tx.certificate.updateMany({
          where: { id: item.id },
          data: { nameEnc: item.nameEnc },
        });
        if (result.count === 0) {
          // 凭证不存在：抛错触发整批回滚，保证迁移的原子性
          throw new ErrorNotFound(`凭证不存在: ${item.id}`);
        }
        count += result.count;
      }
      if (data.finish) {
        await tx.user.updateMany({ data: { metadataVersion: 2 } });
      }
      return count;
    });

    return { updated };
  }
}
