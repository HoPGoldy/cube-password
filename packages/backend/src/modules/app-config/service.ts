import { PrismaClient } from "@db/client";
import { SchemaAppConfigType } from "@/types/app-config";

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

  async getAll(): Promise<SchemaAppConfigType> {
    const configList = await this.options.prisma.appConfig.findMany({
      orderBy: {
        key: "asc",
      },
    });

    const configs: Record<string, string> = {};
    configList.forEach((config) => {
      configs[config.key] = config.value;
    });

    return configs;
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
