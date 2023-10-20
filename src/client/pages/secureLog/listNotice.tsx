import React, { FC, useState } from 'react';
import { useQueryNoticeList } from '@/client/services/security';
import { List, Segmented, Spin } from 'antd';
import { PAGE_SIZE } from '@/config';
import { SecurityNoticeRecord, SecurityNoticeType } from '@/types/security';
import SecurityNotice from '@/client/components/securityNotice';

const READ_OPTIONS = [
  { label: '未读', value: 0 },
  { label: '已读', value: 1 },
];

const NOTICE_SEARCH_OPTIONS = [
  { label: '危险', value: SecurityNoticeType.Danger },
  { label: '警告', value: SecurityNoticeType.Warning },
  { label: '通知', value: SecurityNoticeType.Info },
];

export const NoticeList: FC = () => {
  const [pagination, setPagination] = useState({ page: 1 });
  const { data: noticeListResp, isLoading: loadingNoticeList } = useQueryNoticeList(pagination);

  const renderLogItem = (item: SecurityNoticeRecord) => {
    return <SecurityNotice detail={item} />;
  };

  return (
    <>
      <Spin spinning={loadingNoticeList}>
        <List
          className='mb-4'
          pagination={{
            position: 'bottom',
            align: 'center',
            current: pagination.page,
            pageSize: PAGE_SIZE,
            total: noticeListResp?.data?.total ?? 0,
            showSizeChanger: false,
            onChange: (page) => {
              console.log(page);
              setPagination({ ...pagination, page });
            },
          }}
          dataSource={noticeListResp?.data?.rows ?? []}
          renderItem={renderLogItem}
        />
      </Spin>
    </>
  );
};
