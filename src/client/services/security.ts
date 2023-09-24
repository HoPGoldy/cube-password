import { useMutation, useQuery } from 'react-query';
import { requestPost } from './base';
import { PageSearchFilter } from '@/types/global';

/** 查询通知列表 */
export const useQueryNoticeList = (data: PageSearchFilter) => {
  return useQuery('noticeList', () => requestPost(`security/noticeList`, data));
};

/** 已读全部 */
export const useReadAllNotice = () => {
  return useMutation(async () => {
    return await requestPost<number>('security/readAllNotice');
  });
};
