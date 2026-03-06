import { PrismaService } from "@/modules/prisma";

interface UserServiceDeps {
  prisma: PrismaService;
}

export class UserService {
  private prisma: PrismaService;

  constructor(deps: UserServiceDeps) {
    this.prisma = deps.prisma;
  }

  async setTheme(theme: string): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { theme },
    });
  }

  async getStatistic() {
    const [groupCount, certificateCount] = await Promise.all([
      this.prisma.group.count(),
      this.prisma.certificate.count(),
    ]);
    return { groupCount, certificateCount };
  }

  async updateCreatePwdSetting(
    alphabet: string,
    length: number,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { createPwdAlphabet: alphabet, createPwdLength: length },
    });
  }
}
