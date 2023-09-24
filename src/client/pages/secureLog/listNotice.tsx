import React, { FC, useState } from 'react';
import { useIsMobile } from '@/client/layouts/responsive';
import { useQueryNoticeList } from '@/client/services/security';
import { Table } from 'antd';
import { PAGE_SIZE } from '@/config';

export const NoticeList: FC = () => {
  const isMobile = useIsMobile();
  const [pagination, setPagination] = useState({ page: 1 });
  const { data: noticeListResp, isLoading: loadingNoticeList } = useQueryNoticeList(pagination);

  return (
    <Table
      columns={columns}
      rowKey={(record) => record.login.uuid}
      dataSource={[]}
      pagination={{ current: pagination.page, pageSize: PAGE_SIZE }}
      loading={loadingNoticeList}
      onChange={handleTableChange}
    />
  );
};
