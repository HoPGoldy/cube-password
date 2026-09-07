import { PrismaClient } from "@db/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PATH_DATABASE } from "@/config/path";

interface PrismaServiceOptions {
  /** 数据库地址，默认取环境配置；测试可注入临时库 */
  datasourceUrl?: string;
}

export class PrismaService extends PrismaClient {
  constructor(options: PrismaServiceOptions = {}) {
    const adapter = new PrismaBetterSqlite3({
      url: options.datasourceUrl ?? `file:${PATH_DATABASE}`,
    });

    super({ adapter });
  }

  async seed() {
    // 数据库初始化预留接口
  }
}
