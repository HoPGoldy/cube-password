import { useMutation, useQuery } from 'react-query';
import { queryClient, requestGet, requestPost } from './base';
import {
  CertificateAddReqBody,
  CertificateDetailResp,
  CertificateMoveReqBody,
  CertificateUpdateReqBody,
  SearchCertificateReqData,
  SearchCertificateResp,
} from '@/types/certificate';
import { CertificateListItem } from '@/types/group';

/**
 * 获取随机英文名
 */
export const getRandName = async () => {
  return await requestGet<string>('certificate/randName');
};

/**
 * 获取凭证详情
 */
export const useCertificateDetail = (id: number | undefined) => {
  return useQuery(
    ['certificateDetail', id],
    () => requestGet<CertificateDetailResp>(`certificate/${id}/getDetail`),
    { enabled: !!id && id !== -1 },
  );
};

/**
 * 保存凭证
 */
export const useSaveCertificate = (id: number | undefined) => {
  return useMutation(
    async (data: Partial<CertificateAddReqBody>) => {
      if (id === -1) {
        return await requestPost<CertificateDetailResp>('certificate/add', data);
      }

      return await requestPost<CertificateUpdateReqBody>('certificate/updateDetail', {
        ...data,
        id,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('certificateList');
      },
    },
  );
};

/**
 * 获取分组下属凭证列表
 */
export const useCertificateList = (groupId: number | undefined, groupUnlocked: boolean) => {
  return useQuery(
    ['certificateList', groupId],
    () => requestGet<CertificateListItem[]>(`group/${groupId}/certificates`),
    { enabled: !!groupId && groupUnlocked },
  );
};

/**
 * 移动凭证
 */
export const useMoveCertificate = () => {
  return useMutation(
    async (data: CertificateMoveReqBody) => {
      return await requestPost('certificate/move', data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('certificateList');
      },
    },
  );
};

/**
 * 搜索凭证
 */
export const useSearchCertificate = (data: SearchCertificateReqData) => {
  return useQuery(
    ['certificateSearch', data],
    () => requestPost<SearchCertificateResp>(`certificate/search`, data),
    {
      refetchOnWindowFocus: false,
      enabled: data.keyword !== '' || !!(data.colors && data.colors.length > 0),
    },
  );
};

/**
 * 删除凭证
 */
export const useDeleteCertificate = () => {
  return useMutation(
    async (ids: number[]) => {
      return await requestPost('certificate/delete', { ids });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('certificateList');
      },
    },
  );
};

/**
 * 更新凭证排序
 */
export const useUpdateCertificateSort = () => {
  return useMutation(
    async (ids: number[]) => {
      return await requestPost('certificate/updateSort', { ids });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('certificateList');
      },
    },
  );
};
