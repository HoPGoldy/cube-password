import React, { FC, useState } from 'react';
import { useIsMobile } from '@/client/layouts/responsive';
import { useQueryNoticeList } from '@/client/services/security';
import { Card, List, Table, Tag } from 'antd';
import { PAGE_SIZE } from '@/config';
import { SecurityNoticeRecord } from '@/types/security';
import SecurityNotice from '@/client/components/securityNotice';

export const NoticeList: FC = () => {
  const isMobile = useIsMobile();
  const [pagination, setPagination] = useState({ page: 1 });
  const { data: noticeListResp, isLoading: loadingNoticeList } = useQueryNoticeList(pagination);
  console.log('🚀 ~ file: listNotice.tsx:11 ~ noticeListResp:', noticeListResp);

  const renderLogItem = (item: SecurityNoticeRecord) => {
    console.log('🚀 ~ file: listNotice.tsx:14 ~ renderLogItem ~ item:', item);
    return <SecurityNotice detail={item} />;
  };

  return (
    <List
      pagination={{ position: 'bottom', align: 'center' }}
      dataSource={noticeListResp?.data ?? []}
      renderItem={renderLogItem}
    />
  );
};
