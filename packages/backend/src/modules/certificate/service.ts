import { PrismaService } from "@/modules/prisma";
import { SessionManager } from "@/lib/session";
import { ErrorForbidden, ErrorNotFound } from "@/types/error";

interface CertificateServiceDeps {
  prisma: PrismaService;
  sessionManager: SessionManager;
}

export class CertificateService {
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

  async add(data: {
    name: string;
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
        name: data.name,
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
    name: string;
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
      name: data.name,
      groupId: data.groupId,
    };
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

  async search(params: {
    keyword?: string;
    colors?: string[];
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }) {
    const { keyword, colors, startDate, endDate, page, pageSize } = params;
    const where: Record<string, unknown> = {};

    if (keyword) {
      where.name = { contains: keyword };
    }
    if (colors && colors.length > 0) {
      where.markColor = { in: colors };
    }
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.updatedAt = dateFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          groupId: true,
          markColor: true,
          icon: true,
          updatedAt: true,
        },
      }),
      this.prisma.certificate.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        updatedAt: item.updatedAt.toISOString(),
      })),
      total,
    };
  }
}
