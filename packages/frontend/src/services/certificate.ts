import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, requestPost } from "./base";
import type {
  SchemaCertificateAddBodyType,
  SchemaCertificateDetailResponseType,
  SchemaCertificateIndexResponseType,
  SchemaCertificateListByGroupResponseType,
  SchemaCertificateUpdateBodyType,
} from "@shared-types/certificate";
import { getDefaultStore } from "jotai";
import { stateVault } from "@/store/user";
import {
  setCertNameIndex,
  NAME_DECRYPT_FAILED,
  type CertIndexMeta,
} from "@/store/state-cert-name-index";
import { decryptContent } from "@/lib/e2ee";

/** 凭证写操作后需要失效重建的 query（分组列表 + 内存名称索引） */
export const invalidateCertificateQueries = () => {
  queryClient.invalidateQueries({ queryKey: ["certificateList"] });
  queryClient.invalidateQueries({ queryKey: ["certificateIndex"] });
};

/** 按分组列出凭证 */
export const useCertificateList = (
  groupId: number | undefined,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: ["certificateList", groupId],
    queryFn: () =>
      requestPost<SchemaCertificateListByGroupResponseType>(
        "certificate/list",
        { groupId },
      ),
    enabled: !!groupId && enabled,
    refetchOnWindowFocus: false,
  });
};

/**
 * 解析 certificate/index 响应并重建内存明文名称索引
 * （登录后的 queryCertificateIndex 与迁移完成后的 rebuildCertIndex 共用）
 * - 单条解密失败以占位符写入，不阻塞其余条目
 * - react-query 缓存中只有密文，明文只存在 jotai 内存 atom（logout 清空）
 */
export const applyCertIndexItems = async (
  items: SchemaCertificateIndexResponseType["items"],
) => {
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
      // 单条密文损坏（或 DEK 不匹配）：占位显示，不阻塞整体索引
      names.set(item.id, NAME_DECRYPT_FAILED);
    }
  }
  setCertNameIndex(names, metas);
};

/**
 * 全量凭证索引查询（元数据加密）
 *
 * 拉取全量索引字段（id/nameEnc/icon/markColor/updatedAt/groupId），
 * 用 DEK 解密 nameEnc 构建内存明文索引（store/state-cert-name-index）。
 * 凭证 add/update/delete/move 后 invalidate ["certificateIndex"] 重建
 */
export const queryCertificateIndex = async () => {
  const resp =
    await requestPost<SchemaCertificateIndexResponseType>("certificate/index");
  await applyCertIndexItems(resp.data?.items ?? []);
  return resp;
};

/** 凭证详情 */
export const useCertificateDetail = (id: number | undefined) => {
  return useQuery({
    queryKey: ["certificateDetail", id],
    queryFn: () =>
      requestPost<SchemaCertificateDetailResponseType>("certificate/detail", {
        id,
      }),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
};

/** 添加凭证 */
export const useAddCertificate = () => {
  return useMutation({
    mutationFn: (data: SchemaCertificateAddBodyType) => {
      return requestPost<{ id: number }>("certificate/add", data);
    },
    onSuccess: () => {
      invalidateCertificateQueries();
    },
  });
};

/** 更新凭证 */
export const useUpdateCertificate = () => {
  return useMutation({
    mutationFn: (data: SchemaCertificateUpdateBodyType) => {
      return requestPost("certificate/update", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificateDetail"] });
      invalidateCertificateQueries();
    },
  });
};

/** 删除凭证 */
export const useDeleteCertificate = () => {
  return useMutation({
    mutationFn: (ids: number[]) => {
      return requestPost("certificate/delete", { ids });
    },
    onSuccess: () => {
      invalidateCertificateQueries();
    },
  });
};

/** 移动凭证 */
export const useMoveCertificate = () => {
  return useMutation({
    mutationFn: (data: { ids: number[]; newGroupId: number }) => {
      return requestPost("certificate/move", data);
    },
    onSuccess: () => {
      invalidateCertificateQueries();
    },
  });
};

/** 排序凭证 */
export const useUpdateCertificateSort = () => {
  return useMutation({
    mutationFn: (ids: number[]) => {
      return requestPost("certificate/sort", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
    },
  });
};

/** 元数据迁移（凭证名称密文化）：分批提交 nameEnc，finish 收尾 metadataVersion=2 */
export const useMigrateMetadata = () => {
  return useMutation({
    mutationFn: (data: {
      items: { id: number; nameEnc: string }[];
      finish?: boolean;
    }) => {
      return requestPost<{ updated: number }>(
        "certificate/migrate-metadata",
        data,
      );
    },
  });
};
