/**
 * cube-password v1 → v2 一次性数据迁移脚本（用完即弃，不进 CI，不做兼容维护）
 *
 * 用法：
 *   node --import tsx scripts/migrate-v1-to-v2.mjs [数据库文件路径]
 *   数据库路径缺省为 packages/backend/storage/main.db
 *
 * 行为（实施方案第 8.2 节）：
 *   1. 复制原库为 <db>.v1.bak（强制备份）
 *   2. 交互式输入旧主密码，用 v1 规则 SHA512(salt + 密码) 校验
 *   3. 用 v1 派生（MD5/SHA256/AES-CBC，逻辑内嵌）逐条解密 Certificate.content，
 *      解密失败的条目打印警告、保留原文、跳过
 *   4. 生成新 salt → argon2id → (KEK, V)；生成 DEK → keyBlob；全部凭证重加密为 v2 格式
 *   5. 单事务写回 User 四字段（passwordHash=hex(V)、passwordSalt、keyBlob、kdfParams）+ 全部凭证
 *   6. 迁移后自检 + 打印迁移报告
 *
 * 实现说明：
 *   - v2 密文复用前端 e2ee 模块（hash-wasm + WebCrypto 在 Node 22+ 可直接运行），
 *     保证写出的格式与正式代码完全一致。入口是纯 JS 的 .mjs，通过 tsx loader
 *     加载 e2ee 的 TS 模块（tsx 为 root devDependency）。
 *   - 数据库访问用 Node 内置 node:sqlite，不依赖 backend 的 Prisma client
 *     （兼容尚未加列的 v1 原始 schema）。
 */
import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_KDF_PARAMS,
  deriveMasterKey,
  randomBytes,
  encryptContent,
  decryptContent,
  wrapDek,
  unwrapDek,
  bytesToHex,
} from "../packages/frontend/src/lib/e2ee/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(
  __dirname,
  "../packages/backend/storage/main.db",
);

/* ------------------------------------------------------------------ *
 * v1 加密逻辑（内嵌，等价于改造前的 getAesMeta / aesDecrypt）
 * v1 规则：key = MD5(密码) hex 的 ASCII 字节（32B），iv = SHA256(密码) hex
 * 的 ASCII 字节前 16B，AES-256-CBC + PKCS7，密文为小写 hex。
 * 注意：key 为 32 字节，CryptoJS 按 key 长度自动选择 AES-256（而非实施方案
 * 第 8.1 节描述的 AES-128，文档描述与实际实现不符，以 git 历史实际行为为准）。
 * ------------------------------------------------------------------ */

const v1DeriveAesKey = (password) => {
  // MD5 hex 的 32 个 ASCII 字节直接作为 32B key（AES-256）
  return Buffer.from(
    createHash("md5").update(password, "utf8").digest("hex"),
    "utf8",
  );
};

const v1DeriveAesIv = (password) => {
  const sha256Hex = createHash("sha256").update(password, "utf8").digest("hex");
  return Buffer.from(sha256Hex, "utf8").subarray(0, 16);
};

/** v1 解密，失败（脏数据 / 格式非法 / PKCS7 去填充非法）抛错 */
const v1Decrypt = (content, password) => {
  const decipher = createDecipheriv(
    "aes-256-cbc",
    v1DeriveAesKey(password),
    v1DeriveAesIv(password),
  );
  decipher.setAutoPadding(true); // PKCS7
  return Buffer.concat([
    decipher.update(Buffer.from(content, "hex")),
    decipher.final(),
  ]).toString("utf8");
};

/** v1 密码校验哈希：SHA512(salt + 密码) 大写 hex（与旧 init/login 一致） */
const v1Verifier = (salt, password) =>
  createHash("sha512")
    .update(salt + password, "utf8")
    .digest("hex")
    .toUpperCase();

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

const println = (msg = "") => console.log(msg);
const warn = (msg) => console.warn(`  [警告] ${msg}`);

// 手动维护行队列：readline 的 line 事件在没有 question 挂起时触发会丢行，
// 管道输入时尤其如此；这里统一入队，ask 时消费，兼容管道与 TTY 两种输入
const lineQueue = [];
let lineWaiting = null;
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", (line) => {
  if (lineWaiting) {
    const resolve = lineWaiting;
    lineWaiting = null;
    resolve(line);
  } else {
    lineQueue.push(line);
  }
});
rl.on("close", () => {
  if (lineWaiting) {
    const resolve = lineWaiting;
    lineWaiting = null;
    resolve(null); // EOF：由调用方判定为终止
  }
});

const ask = async (question) => {
  const answer =
    lineQueue.length > 0
      ? lineQueue.shift()
      : await new Promise((resolve) => {
          lineWaiting = resolve;
        });
  if (answer === null) {
    throw new Error("输入流已结束，迁移终止。");
  }
  return answer;
};

/** 常量时间字符串比较（等长比较字面哈希） */
const safeEquals = (a, b) => {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
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
  const backupPath = `${dbPath}.v1.bak`;
  if (existsSync(backupPath)) {
    throw new Error(
      `备份文件已存在：${backupPath}\n为避免覆盖旧备份，请先将其移走或删除后重试。`,
    );
  }
  copyFileSync(dbPath, backupPath);
  return backupPath;
};

/** 读取并校验 v1 库结构 */
const loadUser = (db) => {
  const users = db.prepare("SELECT * FROM User").all();
  if (users.length === 0) {
    throw new Error(
      "User 表为空：目标库尚未初始化（不存在 v1 主密码），无需迁移。",
    );
  }
  if (users.length > 1) {
    throw new Error(`User 表存在 ${users.length} 条记录，预期单用户，终止。`);
  }
  const user = users[0];
  // 幂等保护：kdfParams 非空说明已是 v2 结构，二次迁移会覆盖现有 DEK 导致数据不可解
  if (user.kdfParams) {
    throw new Error(
      "该库已包含 kdfParams（看起来已完成 v2 迁移），拒绝重复迁移。\n如需强制重跑，请先恢复 v1 备份库。",
    );
  }
  if (!user.passwordHash || !user.passwordSalt) {
    throw new Error(
      "User.passwordHash / passwordSalt 为空，疑似未完成 init，终止。",
    );
  }
  return user;
};

/** 确保 v2 列存在（v1 原始 schema 无 keyBlob/kdfParams/Group.keyBlob，列式补齐，幂等） */
const ensureV2Columns = (db) => {
  const columnsOf = (table) =>
    db
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .map((col) => col.name);

  const userColumns = columnsOf("User");
  if (!userColumns.includes("keyBlob")) {
    db.exec(
      'ALTER TABLE "User" ADD COLUMN "keyBlob" TEXT NOT NULL DEFAULT \'\'',
    );
  }
  if (!userColumns.includes("kdfParams")) {
    db.exec(
      'ALTER TABLE "User" ADD COLUMN "kdfParams" TEXT NOT NULL DEFAULT \'\'',
    );
  }
  if (!columnsOf("Group").includes("keyBlob")) {
    db.exec('ALTER TABLE "Group" ADD COLUMN "keyBlob" TEXT');
  }
};

/** 步骤 2：交互输入旧主密码并用 v1 规则校验（最多 5 次） */
const askMainPassword = async (user) => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const password = await ask("请输入旧主密码: ");
    if (
      safeEquals(v1Verifier(user.passwordSalt, password), user.passwordHash)
    ) {
      return password;
    }
    println(`密码错误（还剩 ${5 - attempt} 次机会）`);
  }
  throw new Error("连续 5 次密码错误，终止迁移（原库未做任何修改）。");
};

/** 步骤 3：v1 逻辑逐条解密，失败条目警告并跳过 */
const decryptAllCertificates = (db, password) => {
  const certificates = db
    .prepare("SELECT id, name, content FROM Certificate")
    .all();

  const items = [];
  let skipped = 0;

  for (const cert of certificates) {
    try {
      // 空 content 视为空字符串明文（正常迁移为 v2 空密文）
      items.push({
        ...cert,
        plaintext: cert.content === "" ? "" : v1Decrypt(cert.content, password),
      });
    } catch {
      warn(
        `凭证 #${cert.id}（${cert.name}）解密失败，将跳过并保留原文` +
          `（可能是脏数据或非主密码加密的条目）`,
      );
      skipped += 1;
    }
  }

  return { items, skipped };
};

/** 步骤 4：派生 (KEK, V) + 生成 DEK/keyBlob + 全部凭证重加密为 v2 */
const deriveAndReencrypt = async (items, password) => {
  println("\n正在派生新密钥（argon2id，约需数秒）...");
  const salt = randomBytes(32);
  const { kek, verifier } = await deriveMasterKey(password, salt);

  const dek = randomBytes(32);
  const keyBlob = await wrapDek(kek, dek);

  const reencrypted = new Map();
  for (const item of items) {
    reencrypted.set(item.id, await encryptContent(dek, item.plaintext));
  }

  return {
    passwordSalt: bytesToHex(salt),
    passwordHash: bytesToHex(verifier),
    keyBlob,
    kdfParams: JSON.stringify(DEFAULT_KDF_PARAMS),
    reencrypted,
    dek,
    kek,
  };
};

/** 步骤 5：单事务写回 User 四字段 + 全部凭证 */
const writeBack = (db, user, derived, migratedIds) => {
  // 与 Prisma @prisma/adapter-better-sqlite3 的 DateTime 存储格式一致（iso8601 +00:00 后缀）
  const now = new Date().toISOString().replace("Z", "+00:00");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE User SET "passwordHash" = ?, "passwordSalt" = ?, "keyBlob" = ?, "kdfParams" = ?
       WHERE "id" = ?`,
    ).run(
      derived.passwordHash,
      derived.passwordSalt,
      derived.keyBlob,
      derived.kdfParams,
      user.id,
    );

    const updateCert = db.prepare(
      'UPDATE Certificate SET "content" = ?, "updatedAt" = ? WHERE "id" = ?',
    );
    for (const id of migratedIds) {
      updateCert.run(derived.reencrypted.get(id), now, id);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

/** 步骤 6 前置：迁移后自检（keyBlob 解回 DEK + v2 凭证可解） */
const verifyMigration = async (dbPath, userId, derived, migratedIds) => {
  const verifyDb = new DatabaseSync(dbPath);
  try {
    const row = verifyDb
      .prepare('SELECT "keyBlob", "kdfParams" FROM User WHERE "id" = ?')
      .get(userId);
    const roundtripDek = await unwrapDek(derived.kek, row.keyBlob);
    if (
      Buffer.from(roundtripDek).toString("hex") !==
      Buffer.from(derived.dek).toString("hex")
    ) {
      throw new Error("自检失败：keyBlob 解出的 DEK 与写入值不一致");
    }
    if (migratedIds.length > 0) {
      const first = verifyDb
        .prepare('SELECT "content" FROM Certificate WHERE "id" = ?')
        .get(migratedIds[0]);
      await decryptContent(roundtripDek, first.content);
    }
  } finally {
    verifyDb.close();
  }
};

/** 步骤 6：迁移报告 + 验证提示 */
const printReport = (backupPath, total, migrated, skipped) => {
  println("\n========== 迁移报告 ==========");
  println(`备份文件    : ${backupPath}`);
  println(`凭证总数    : ${total}`);
  println(`迁移成功    : ${migrated}`);
  println(`警告跳过    : ${skipped}`);
  println("==============================");
  println(
    "\n迁移完成。请重启服务，然后使用同一主密码登录（旧密码哈希已被替换为 argon2id verifier V）。",
  );
  println("确认应用运行正常后，可删除备份文件（.v1.bak）与本脚本。");
};

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

const main = async () => {
  const dbPath = resolve(process.argv[2] ?? DEFAULT_DB_PATH);
  if (!existsSync(dbPath)) {
    throw new Error(`数据库文件不存在：${dbPath}`);
  }
  println("cube-password v1 → v2 数据迁移");
  println(`数据库文件: ${dbPath}\n`);

  println("(1/6) 备份原库...");
  const backupPath = backupDatabase(dbPath);
  println(`已备份到 ${backupPath}`);

  const db = new DatabaseSync(dbPath);
  try {
    const user = loadUser(db);
    ensureV2Columns(db);

    println("(2/6) 校验旧主密码...");
    const password = await askMainPassword(user);

    println("(3/6) 使用 v1 逻辑解密全部凭证...");
    const { items, skipped } = decryptAllCertificates(db, password);
    println(`解密成功 ${items.length} 条，跳过 ${skipped} 条`);

    println("(4/6) 派生密钥并重新加密...");
    const derived = await deriveAndReencrypt(items, password);

    println("(5/6) 单事务写回...");
    const migratedIds = items.map((item) => item.id);
    writeBack(db, user, derived, migratedIds);

    println("(6/6) 迁移后自检（keyBlob + v2 凭证可解）...");
    await verifyMigration(dbPath, user.id, derived, migratedIds);
    println("自检通过");

    printReport(backupPath, items.length + skipped, items.length, skipped);
  } finally {
    db.close();
  }
};

main().catch((error) => {
  console.error(
    `\n迁移失败: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
});
