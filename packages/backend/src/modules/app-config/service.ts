import { PrismaClient } from "@db/client";

interface ServiceOptions {
  prisma: PrismaClient;
}

export class AppConfigService {
  constructor(private options: ServiceOptions) {}

  async findByKey(key: string) {
    return this.options.prisma.appConfig.findUnique({
      where: { key },
    });
  }

  async setConfigValues(configs: Record<string, string>) {
    if (!Object.keys(configs).length) {
      return;
    }

    const result = await this.options.prisma.$transaction(
      Object.entries(configs).map(([key, value]) =>
        this.options.prisma.appConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    return result;
  }
}
