import { getDefaultStore } from "jotai";
import type { QueryClient } from "@tanstack/react-query";
import { requestPost, queryClient as globalQueryClient } from "./base";
import type {
  SchemaCertificateDetailResponseType,
  SchemaCertificateIndexResponseType,
} from "@shared-types/certificate";
import type { SchemaGroupItemType } from "@shared-types/group";
import { stateVault, stateUser } from "@/store/user";
import {
  setCertNameIndex,
  NAME_DECRYPT_FAILED,
  type CertIndexMeta,
} from "@/store/state-cert-name-index";
import { decryptContent, encryptContent } from "@/lib/e2ee";

/** 单批迁移条数上限（后端 migrate-metadata 校验同值） */
export const MIGRATE_BATCH_SIZE = 100;

/**
 * 存量迁移进度探测：拉全量索引，统计 nameEnc 为空串的条目 id 列表
 * （空串 = 尚未迁移；天然幂等，中断后重登重试只处理剩余条目）
 */
export const fetchPendingMigrateIds = async (): Promise<{
  /** 待迁移条目（还需拉明文详情） */
  pendingIds: number[];
  /** 索引总条目数 */
  total: number;
}> => {
  const resp =
    await requestPost<SchemaCertificateIndexResponseType>("certificate/index");
  const items = resp.data?.items ?? [];
  return {
    pendingIds: items.filter((item) => !item.nameEnc).map((item) => item.id),
    total: items.length,
  };
};

/** 拉取单条凭证明文名称（detail 受写门禁保护：锁定分组的凭证拉不到） */
export const fetchCertificateName = async (
  id: number,
): Promise<string | null> => {
  try {
    const resp = await requestPost<SchemaCertificateDetailResponseType>(
      "certificate/detail",
      { id },
    );
    return resp.data?.name ?? null;
  } catch {
    return null;
  }
};

/** 分批提交迁移（≤100/批），finish=true 的最后一批同事务收尾 metadataVersion=2 */
export const migrateBatch = async (
  items: { id: number; nameEnc: string }[],
  finish: boolean,
): Promise<void> => {
  await requestPost("certificate/migrate-metadata", { items, finish });
};

/**
 * 执行存量迁移：逐条取明文 → DEK 加密 → 分批提交 → 最后一批 finish 收尾
 *
 * 前置：调用方须确保全部分组已解锁（锁定分组 detail 403，无法读明文名）
 *
 * @returns 成功迁移条数
 * @throws 中途失败时抛出；已提交的批次不回滚，剩余进度以 nameEnc 空串判断（幂等可重试）
 */
export const runMetadataMigration = async (
  pendingIds: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> => {
  const dek = getDefaultStore().get(stateVault).dek;
  if (!dek) {
    throw new Error("密钥缺失，请重新登录后再试");
  }

  let done = 0;
  const total = pendingIds.length;
  let batch: { id: number; nameEnc: string }[] = [];

  for (const id of pendingIds) {
    const name = await fetchCertificateName(id);
    if (name == null) {
      // 凭证被并发删除或分组不可达：跳过，等 finish 收尾（该条保持未迁移态）
      done += 1;
      onProgress?.(done, total);
      continue;
    }

    const nameEnc = await encryptContent(dek, name);
    batch.push({ id, nameEnc });

    if (batch.length >= MIGRATE_BATCH_SIZE) {
      await migrateBatch(batch, false);
      done += batch.length;
      batch = [];
      onProgress?.(done, total);
    }
  }

  if (batch.length > 0) {
    done += batch.length;
  }
  // 最后一批（含空批次）finish=true：同事务写 metadataVersion=2
  await migrateBatch(batch, true);
  onProgress?.(done, total);

  // 迁移完成后更新本地迁移标志、重建内存索引并刷新分组列表
  await finishMigration();

  return done;
};

/**
 * 迁移收尾（幂等安全）：
 * - 服务端：空批 finish（migrate-metadata { items: [], finish: true }）——含空库用户，
 *   服务端 metadataVersion 真实收敛为 2，后续登录不再探测
 * - 本地：stateUser.metadataVersion → 2（避免同会话内重复弹迁移提示）
 * - 重建内存索引并失效分组列表（certificateCount 展示）、作废迁移探测缓存
 */
export const finishMigration = async (
  client: QueryClient = globalQueryClient,
): Promise<void> => {
  // 服务端收尾：空批 finish 与真实迁移末批同构（后端单事务写 metadataVersion=2）
  await migrateBatch([], true);

  const store = getDefaultStore();
  const userInfo = store.get(stateUser);
  if (userInfo && userInfo.metadataVersion !== 2) {
    store.set(stateUser, { ...userInfo, metadataVersion: 2 });
  }

  await rebuildCertIndex();
  client.invalidateQueries({ queryKey: ["groupList"] });
  client.removeQueries({ queryKey: ["metadataMigrationPending"] });
};

/**
 * 迁移完成后重建内存索引（等效 queryCertificateIndex，但不经 react-query 缓存）
 */
export const rebuildCertIndex = async (): Promise<void> => {
  const resp =
    await requestPost<SchemaCertificateIndexResponseType>("certificate/index");
  const items = resp.data?.items ?? [];
  const dek = getDefaultStore().get(stateVault).dek;

  const names = new Map<number, string>();
  const metas = new Map<number, CertIndexMeta>();
  for (const item of items) {
    metas.set(item.id, {
      icon: item.icon,
      markColor: item.markColor,
      updatedAt: item.updatedAt,
      groupId: item.groupId,
    });
    if (!item.nameEnc || !dek) {
      names.set(item.id, NAME_DECRYPT_FAILED);
      continue;
    }
    try {
      names.set(item.id, await decryptContent(dek, item.nameEnc));
    } catch {
      names.set(item.id, NAME_DECRYPT_FAILED);
    }
  }
  setCertNameIndex(names, metas);
};

/**
 * 迁移前置检查：是否存在「有凭证且当前 session 未解锁」的分组
 * （锁定分组凭证的明文名不可读且后端写门禁会 403，须先解锁全部分组）。
 * 注意以 session 解锁态为准而非 lockType：用户本 session 已解锁的组可以迁移，
 * 否则重登后锁定组必然回到锁定态，用户将永远没有执行迁移的窗口。
 */
export const hasLockedGroupsMigrationBlocker = (
  groupList: SchemaGroupItemType[],
  unlockedGroupIds: Set<number>,
): boolean => {
  return groupList.some(
    (group) =>
      group.lockType !== "None" &&
      !unlockedGroupIds.has(group.id) &&
      group.certificateCount > 0,
  );
};
