import React, { FC, useState } from 'react';
import { Button, Card, Col, Form, List, Row, Select, Space, Spin } from 'antd';
import { SettingContainerProps } from '@/client/components/settingContainer';
import { useIsMobile } from '@/client/layouts/responsive';
import { ActionButton, ActionIcon, PageAction, PageContent } from '@/client/layouts/pageWithAction';
import { LeftOutlined } from '@ant-design/icons';
import { useQueryNoticeList, useReadAllNotice } from '@/client/services/security';
import { SecurityNoticeRecord, SecurityNoticeType } from '@/types/security';
import SecurityNotice from '@/client/pages/secureLog/components/securityNotice';
import { PAGE_SIZE } from '@/config';

const READ_OPTIONS = [
  { label: '未读', value: 0 },
  { label: '已读', value: 1 },
];

const NOTICE_SEARCH_OPTIONS = [
  { label: '危险', value: SecurityNoticeType.Danger },
  { label: '警告', value: SecurityNoticeType.Warning },
  { label: '通知', value: SecurityNoticeType.Info },
];

export const Content: FC<SettingContainerProps> = (props) => {
  const isMobile = useIsMobile();
  const { mutateAsync, isLoading } = useReadAllNotice();
  const [searchForm] = Form.useForm();
  const [searchData, setSearchData] = useState({ isRead: 0 });
  const [pagination, setPagination] = useState({ page: 1 });
  const {
    data: noticeListResp,
    isFetching: loadingNoticeList,
    refetch,
  } = useQueryNoticeList({
    ...searchData,
    ...pagination,
  });

  const renderLogItem = (item: SecurityNoticeRecord) => {
    return <SecurityNotice detail={item} />;
  };

  const renderContent = () => {
    return (
      <Spin spinning={loadingNoticeList}>
        <Form
          layout='horizontal'
          form={searchForm}
          initialValues={searchData}
          onValuesChange={(_, values) => setSearchData(values)}>
          <Row gutter={[20, 0]} align='middle'>
            <Col span='12'>
              <Form.Item name='isRead' noStyle>
                <Select
                  options={READ_OPTIONS}
                  className='w-full'
                  placeholder='是否已读'
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span='12'>
              <Form.Item name='type' noStyle>
                <Select
                  options={NOTICE_SEARCH_OPTIONS}
                  className='w-full'
                  placeholder='警报等级'
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
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
          locale={{ emptyText: <div className='mt-6'>暂无通知</div> }}
          dataSource={noticeListResp?.data?.rows ?? []}
          renderItem={renderLogItem}
        />
      </Spin>
    );
  };

  const onReadAll = async () => {
    await mutateAsync();
    refetch();
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className='flex flex-row-reverse'>
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            <Button onClick={onReadAll} loading={isLoading} type='primary'>
              已读全部
            </Button>
          </Space>
        </div>
      </>
    );
  }

  return (
    <>
      <PageContent>
        <div className='m-4 md:m-0'>
          <Card size='small' className='text-center text-base font-bold mb-4'>
            {props.title}
          </Card>
          {renderContent()}
        </div>
      </PageContent>

      <PageAction>
        <ActionIcon icon={<LeftOutlined />} onClick={props.onClose} />
        <ActionButton>新增邀请码</ActionButton>
      </PageAction>
    </>
  );
};
