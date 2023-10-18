import { SecurityNoticeRecord, SecurityNoticeType } from '@/types/security';
import { Card, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { FC } from 'react';

interface Props {
  detail: SecurityNoticeRecord;
}

export const noticeConfig = {
  [SecurityNoticeType.Danger]: { color: 'red', label: '危险' },
  [SecurityNoticeType.Warning]: { color: 'orange', label: '警告' },
  [SecurityNoticeType.Info]: { color: 'blue', label: '提示' },
};

const SecurityNotice: FC<Props> = (props) => {
  const { detail } = props;
  const config = noticeConfig[detail.type];

  return (
    <Card
      style={{ marginTop: 16 }}
      type='inner'
      size='small'
      title={
        <>
          <Tag color={config.color}>{config.label}</Tag>
          <span>{detail.title}</span>
        </>
      }
      extra={dayjs(detail.date).format('YYYY-MM-DD HH:mm:ss')}>
      {detail.content}
    </Card>
  );
};

export default SecurityNotice;
