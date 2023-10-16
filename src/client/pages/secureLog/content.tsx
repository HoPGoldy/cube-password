import React, { FC } from 'react';
import { Button, Card, Space } from 'antd';
import { SettingContainerProps } from '@/client/components/settingContainer';
import { useIsMobile } from '@/client/layouts/responsive';
import { ActionButton, ActionIcon, PageAction, PageContent } from '@/client/layouts/pageWithAction';
import { LeftOutlined } from '@ant-design/icons';
import { NoticeList } from './listNotice';

export const Content: FC<SettingContainerProps> = (props) => {
  const isMobile = useIsMobile();

  const renderContent = () => {
    return <NoticeList />;
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className='flex flex-row-reverse'>
          <Space>
            <Button onClick={props.onClose}>返回</Button>
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
