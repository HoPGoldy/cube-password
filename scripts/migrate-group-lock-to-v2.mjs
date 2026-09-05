/**
 * 一次性脚本：存量 v1 分组锁密码 → v2 argon2id 迁移（用完即弃，用完删除本文件）
 *
 * 背景（docs/plans/v2-followup T05）：分组锁 v1 格式为弱哈希
 * `passwordHash = SHA512(salt + pwd)`（可 GPU 秒破），T04 已把新落库格式升级为
 * argon2id KDF 体系（kdfParams 非空）。存量 v1 数据无法由服务端换算，必须由
 * owner 逐组输入旧分组密码、本地验旧 hash 通过后重新派生写回。
 *
 * 用法：
 *   node scripts/migrate-group-lock-to-v2.mjs [数据库文件路径]
 *   数据库路径缺省为 packages/backend/storage/main.db
 *
 * 行为：
 *   1. 复制原库为 <db>.bak-group-lock-<timestamp>（强制备份）
 *   2. 查询 lockType='Password' 且 kdfParams 为空的 v1 锁分组
 *   3. 逐组交互输入旧密码，本地按 v1 规则校验（大写 hex(SHA512(salt+pwd))）；
 *      校验失败的分组打印错误并跳过（保持原数据，可修复后重跑）
 *   4. 校验通过的分组：新 salt → argon2id(password, salt, m=65536,t=2,p=1)
 *      输出 64B 取后 32B 为 V（与前端 e2ee/kdf.ts deriveMasterKey 一致），
 *      写回 passwordHash=hex(V)、passwordSalt=hex(salt)、kdfParams=JSON
 *   5. 全部写回在单个事务中完成；迁移后自检 + 打印结果清单
 *
 * 实现说明：
 *   - 派生逻辑与 packages/e2e/fixtures/api.ts 的 deriveMasterKey 等价
 *     （argon2id 由 hash-wasm 提供，同构于前端 e2ee/kdf.ts）。
 *   - hash-wasm 通过 createRequire 指向 packages/frontend/package.json 解析
 *     （pnpm 目录布局下 frontend 是唯一直接依赖方）。
 *   - 数据库访问用 Node 内置 node:sqlite，不依赖 backend 的 Prisma client。
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(
  __dirname,
  "../packages/backend/storage/main.db",
);

/* ------------------------------------------------------------------ *
 * 常量（与 packages/frontend/src/lib/e2ee/kdf.ts 保持一致）
 * ------------------------------------------------------------------ */

/** salt 长度（字节），同 e2ee/kdf.ts 的 SALT_LENGTH */
const SALT_LENGTH = 32;
/** argon2id 输出 64B：前 32B = KEK（分组场景不使用，丢弃），后 32B = V */
const KDF_HASH_LENGTH = 64;
/** v2 kdfParams（与 e2ee/kdf.ts 的 DEFAULT_KDF_PARAMS 一致） */
const KDF_PARAMS = JSON.stringify({
  algorithm: "argon2id",
  m: 65536,
  t: 2,
  p: 1,
  version: 1,
});

/* ------------------------------------------------------------------ *
 * 依赖解析：hash-wasm（经 frontend 的 pnpm 目录解析）
 * ------------------------------------------------------------------ */

const loadHashWasm = () => {
  try {
    const require = createRequire(
      resolve(__dirname, "../packages/frontend/package.json"),
    );
    return require("hash-wasm");
  } catch {
    throw new Error(
      "无法加载 hash-wasm：请先在仓库根目录执行 pnpm install" +
        "（hash-wasm 由 packages/frontend 依赖提供）",
    );
  }
};

const { argon2id } = loadHashWasm();

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

const println = (msg = "") => console.log(msg);
const warn = (msg) => console.warn(`  [警告] ${msg}`);

// 手动维护行队列：readline 的 line 事件在没有 question 挂起时触发会丢行，
// 管道输入时尤其如此；这里统一入队，ask 时消费，兼容管道与 TTY 两种输入
// （与 scripts/migrate-v1-to-v2.mjs 相同的做法）
const lineQueue = [];
let lineWaiting = null;
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", (line) => {
  if (lineWaiting) {
    const resolveLine = lineWaiting;
    lineWaiting = null;
    resolveLine(line);
  } else {
    lineQueue.push(line);
  }
});
rl.on("close", () => {
  if (lineWaiting) {
    const resolveLine = lineWaiting;
    lineWaiting = null;
    resolveLine(null); // EOF：由调用方判定为终止
  }
});

const ask = async (question) => {
  const answer =
    lineQueue.length > 0
      ? lineQueue.shift()
      : await new Promise((resolveLine) => {
          lineWaiting = resolveLine;
        });
  if (answer === null) {
    throw new Error("输入流已结束，迁移终止。");
  }
  return answer;
};

/** 常量时间字符串比较（比较字面哈希） */
const safeEquals = (a, b) => {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

/* ------------------------------------------------------------------ *
 * v1 校验 / v2 派生
 * ------------------------------------------------------------------ */

/**
 * v1 分组锁密码校验哈希：大写 hex(SHA512(salt + 密码))
 * salt 为旧前端生成锁时的 nanoid(128) 字符串原样参与拼接（非 hex 解码）
 */
const v1Verifier = (salt, password) =>
  createHash("sha512")
    .update(salt + password, "utf8")
    .digest("hex")
    .toUpperCase();

/**
 * v2 派生：argon2id(password, salt) → 64B，取后 32B 为 V
 * （等价于 e2ee/kdf.ts 的 deriveMasterKey：kek = 前 32B，分组场景丢弃）
 */
const deriveV2Verifier = async (password, saltBytes) => {
  const derived = await argon2id({
    password,
    salt: saltBytes,
    parallelism: 1,
    iterations: 2,
    memorySize: 65536,
    hashLength: KDF_HASH_LENGTH,
    outputType: "binary",
  });
  return derived.slice(32, KDF_HASH_LENGTH);
};

/* ------------------------------------------------------------------ *
 * 迁移步骤
 * ------------------------------------------------------------------ */

/** 步骤 1：强制备份原库 */
const backupDatabase = (dbPath) => {
  // WAL 模式下部分数据可能只在 -wal 文件中，直接复制主文件会得到不完整备份
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(dbPath + suffix)) {
      throw new Error(
        `检测到 ${dbPath}${suffix}：数据库可能处于 WAL 模式，直接复制文件会产生不完整备份，终止。`,
      );
    }
  }
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 17); // YYYYMMDDHHMMSSmmm（含毫秒，避免同秒内重跑撞名）
  const backupPath = `${dbPath}.bak-group-lock-${timestamp}`;
  if (existsSync(backupPath)) {
    throw new Error(
      `备份文件已存在：${backupPath}\n为避免覆盖旧备份，请先将其移走或删除后重试。`,
    );
  }
  copyFileSync(dbPath, backupPath);
  return backupPath;
};

/** 步骤 2：查询待迁移的 v1 Password 锁分组 */
const loadV1LockedGroups = (db) => {
  return db
    .prepare(
      `SELECT "id", "name", "passwordHash", "passwordSalt"
       FROM "Group"
       WHERE "lockType" = 'Password' AND ("kdfParams" IS NULL OR "kdfParams" = '')
       ORDER BY "id" ASC`,
    )
    .all();
};

/**
 * 步骤 3：逐组输入旧密码并按 v1 规则校验
 * 通过的返回待派生列表；失败的打印错误跳过（保持原数据，可重跑）
 */
const collectVerifiedGroups = async (groups) => {
  const verified = [];
  const skipped = [];

  for (const group of groups) {
    println(
      `\n分组 #${group.id}（${group.name}）：请输入该分组的旧锁密码（留空跳过该组）`,
    );
    const password = await ask("旧密码: ");
    if (password === "") {
      warn(`分组 #${group.id}（${group.name}）手动跳过，保持原数据`);
      skipped.push(group);
      continue;
    }

    const expected = (group.passwordHash ?? "").toUpperCase();
    if (!expected || !group.passwordSalt) {
      warn(
        `分组 #${group.id}（${group.name}）passwordHash/passwordSalt 为空，疑似脏数据，跳过`,
      );
      skipped.push(group);
      continue;
    }

    if (!safeEquals(v1Verifier(group.passwordSalt, password), expected)) {
      warn(
        `分组 #${group.id}（${group.name}）旧密码校验失败，跳过该组（保持原数据，可修复后重跑）`,
      );
      skipped.push(group);
      continue;
    }

    println(`  校验通过，待重新派生`);
    verified.push({ ...group, password });
  }

  return { verified, skipped };
};

/** 步骤 4：为校验通过的分组重新派生（新 salt + argon2id → V） */
const deriveAll = async (verifiedGroups) => {
  println(
    `\n正在为 ${verifiedGroups.length} 个分组派生新密钥（argon2id，每组约 0.5s）...`,
  );
  const derived = [];
  for (const group of verifiedGroups) {
    const salt = randomBytes(SALT_LENGTH);
    const verifier = await deriveV2Verifier(group.password, salt);
    derived.push({
      id: group.id,
      name: group.name,
      passwordHash: Buffer.from(verifier).toString("hex"),
      passwordSalt: Buffer.from(salt).toString("hex"),
      kdfParams: KDF_PARAMS,
    });
  }
  return derived;
};

/** 步骤 5：单事务写回三字段 */
const writeBack = (db, derived) => {
  // 与 Prisma @prisma/adapter-better-sqlite3 的 DateTime 存储格式一致（iso8601 +00:00 后缀）
  const now = new Date().toISOString().replace("Z", "+00:00");

  db.exec("BEGIN IMMEDIATE");
  try {
    const update = db.prepare(
      `UPDATE "Group"
       SET "passwordHash" = ?, "passwordSalt" = ?, "kdfParams" = ?, "updatedAt" = ?
       WHERE "id" = ?`,
    );
    for (const item of derived) {
      update.run(
        item.passwordHash,
        item.passwordSalt,
        item.kdfParams,
        now,
        item.id,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

/** 迁移后自检：从库内回读第一条，按 kdfParams 独立重派生并比对 V */
const verifyMigration = async (dbPath, firstDerived) => {
  const verifyDb = new DatabaseSync(dbPath, {
    readOnly: true,
  });
  try {
    const row = verifyDb
      .prepare(
        `SELECT "passwordHash", "passwordSalt", "kdfParams"
         FROM "Group" WHERE "id" = ?`,
      )
      .get(firstDerived.id);

    if (!row || !row.passwordHash || !row.passwordSalt || !row.kdfParams) {
      throw new Error("自检失败：库内回读数据为空，写回未生效");
    }

    const params = JSON.parse(row.kdfParams);
    if (
      params.algorithm !== "argon2id" ||
      params.m !== 65536 ||
      params.t !== 2 ||
      params.p !== 1 ||
      params.version !== 1
    ) {
      throw new Error(`自检失败：库内 kdfParams 非预期：${row.kdfParams}`);
    }

    const verifier = await deriveV2Verifier(
      firstDerived.password,
      Uint8Array.from(Buffer.from(row.passwordSalt, "hex")),
    );
    if (
      !safeEquals(
        Buffer.from(verifier).toString("hex"),
        row.passwordHash.toLowerCase(),
      )
    ) {
      throw new Error("自检失败：重派生 V 与库内 passwordHash 不一致");
    }
  } finally {
    verifyDb.close();
  }
};

/** 步骤 6：结果清单 */
const printReport = (backupPath, migrated, skipped) => {
  println("\n========== 迁移结果 ==========");
  println(`备份文件      : ${backupPath}`);
  println(`待迁移分组总数: ${migrated.length + skipped.length}`);
  println(`迁移成功      : ${migrated.length}`);
  for (const item of migrated) {
    println(`  - #${item.id}（${item.name}）→ v2 argon2id`);
  }
  println(`跳过          : ${skipped.length}`);
  for (const item of skipped) {
    println(`  - #${item.id}（${item.name}）保持原数据，可修复后重跑`);
  }
  println("==============================");
  println(
    "\n迁移完成。请重启服务并用迁移时输入的密码解锁对应分组验证；确认正常后可删除备份文件与本脚本。",
  );
  println("被跳过的分组仍是 v1 旧格式，解锁时应用会提示重新设置分组锁密码。");
};

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

const main = async () => {
  const dbPath = resolve(process.argv[2] ?? DEFAULT_DB_PATH);
  if (!existsSync(dbPath)) {
    throw new Error(`数据库文件不存在：${dbPath}`);
  }
  println("cube-password 存量 v1 分组锁密码 → v2 argon2id 迁移");
  println(`数据库文件: ${dbPath}`);

  println("\n(1/6) 备份原库...");
  const backupPath = backupDatabase(dbPath);
  println(`已备份到 ${backupPath}`);

  const db = new DatabaseSync(dbPath);
  try {
    println("(2/6) 查询待迁移的 v1 锁分组...");
    const groups = loadV1LockedGroups(db);
    if (groups.length === 0) {
      println(
        "未发现待迁移的 v1 锁分组（Password 锁均已为 v2 格式），无需迁移。",
      );
      return;
    }
    println(`发现 ${groups.length} 个待迁移分组：`);
    for (const group of groups) {
      println(`  - #${group.id}（${group.name}）`);
    }

    println("(3/6) 逐组校验旧密码...");
    const { verified, skipped } = await collectVerifiedGroups(groups);
    if (verified.length === 0) {
      println("\n没有任何分组校验通过，未对数据库做任何修改。");
      printReport(backupPath, [], skipped);
      return;
    }

    println("(4/6) 重新派生（argon2id）...");
    const derived = await deriveAll(verified);

    println("(5/6) 单事务写回...");
    writeBack(db, derived);
    println(`已写回 ${derived.length} 个分组`);

    println("(6/6) 迁移后自检...");
    await verifyMigration(dbPath, {
      ...derived[0],
      password: verified[0].password,
    });
    println("自检通过");

    printReport(backupPath, derived, skipped);
  } finally {
    db.close();
  }
};

main()
  .catch((error) => {
    console.error(
      `\n迁移失败: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
