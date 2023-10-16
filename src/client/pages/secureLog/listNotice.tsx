import React, { FC, useState } from 'react';
import { useIsMobile } from '@/client/layouts/responsive';
import { useQueryNoticeList } from '@/client/services/security';
import { List, Table } from 'antd';
import { PAGE_SIZE } from '@/config';

export const NoticeList: FC = () => {
  const isMobile = useIsMobile();
  const [pagination, setPagination] = useState({ page: 1 });
  const { data: noticeListResp, isLoading: loadingNoticeList } = useQueryNoticeList(pagination);
  console.log('🚀 ~ file: listNotice.tsx:11 ~ noticeListResp:', noticeListResp);

  const columns = [{}];

  return (
    // <Table
    //   columns={columns}
    //   rowKey='id'
    //   dataSource={[]}
    //   pagination={{
    //     current: pagination.page,
    //     pageSize: PAGE_SIZE,
    //     onChange: (page) => setPagination({ page }),
    //   }}
    //   loading={loadingNoticeList}
    // />
    <List
      pagination={{ position: 'bottom', align: 'center' }}
      dataSource={noticeListResp?.data ?? []}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={<a href='https://ant.design'>{item.title}</a>}
            description='Ant Design, a design language for background applications, is refined by Ant UED Team'
          />
        </List.Item>
      )}
    />
  );
};
