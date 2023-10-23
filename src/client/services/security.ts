import { useMutation, useQuery } from 'react-query';
import { queryClient, requestGet, requestPost } from './base';
import { PageSearchFilter, QueryListResp } from '@/types/global';

/** 查询通知列表 */
export const useQueryNoticeList = (data: PageSearchFilter) => {
  return useQuery(['noticeList', data], () =>
    requestGet<QueryListResp>(`security/noticeList`, {
      params: data,
    }),
  );
};

/** 已读全部 */
export const useReadAllNotice = () => {
  return useMutation(
    async () => {
      return await requestPost<number>('security/readAllNotice');
    },
    {
      onSuccess: () => {
        queryClient.setQueryData('noticeList', undefined);
      },
    },
  );
};

/** 删除全部 */
export const useRemoveAllNotice = () => {
  return useMutation(async () => {
    return await requestPost<number>('security/removeAllNotice');
  });
};
