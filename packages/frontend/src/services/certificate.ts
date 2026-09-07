import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, requestPost } from "./base";
import type {
  SchemaCertificateAddBodyType,
  SchemaCertificateDetailResponseType,
  SchemaCertificateListByGroupResponseType,
  SchemaCertificateSearchBodyType,
  SchemaCertificateSearchResponseType,
  SchemaCertificateUpdateBodyType,
} from "@shared-types/certificate";

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
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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
      queryClient.invalidateQueries({ queryKey: ["certificateList"] });
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

/** 搜索凭证 */
export const useSearchCertificate = (
  data: SchemaCertificateSearchBodyType,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: ["certificateSearch", data],
    queryFn: () =>
      requestPost<SchemaCertificateSearchResponseType>(
        "certificate/search",
        data,
      ),
    refetchOnWindowFocus: false,
    enabled,
  });
};
