import { PrismaService } from "@/modules/prisma";
import { NoticeType } from "@/types/notification";

interface NotificationServiceDeps {
  prisma: PrismaService;
}

export class NotificationService {
  private prisma: PrismaService;

  constructor(deps: NotificationServiceDeps) {
    this.prisma = deps.prisma;
  }

  async createNotice(
    title: string,
    content: string,
    type: NoticeType,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { title, content, type },
    });
  }

  async list(params: {
    page: number;
    pageSize: number;
    type?: number;
    isRead?: number;
  }) {
    const { page, pageSize, type, isRead } = params;
    const where: Record<string, unknown> = {};
    if (type !== undefined) where.type = type;
    if (isRead !== undefined) where.isRead = isRead;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        date: item.date.toISOString(),
      })),
      total,
    };
  }

  async hasUnread(): Promise<boolean> {
    const count = await this.prisma.notification.count({
      where: { isRead: 0 },
    });
    return count > 0;
  }

  async readAll(): Promise<void> {
    await this.prisma.notification.updateMany({
      data: { isRead: 1 },
    });
  }

  async removeAll(): Promise<void> {
    await this.prisma.notification.deleteMany();
  }

  /**
   * 指定时间之后是否已存在同标题通知（时间窗去重判定；
   * 通知被删除即视为窗口重置）
   */
  async hasRecentNotice(title: string, since: Date): Promise<boolean> {
    const count = await this.prisma.notification.count({
      where: { title, date: { gte: since } },
    });
    return count > 0;
  }
}
