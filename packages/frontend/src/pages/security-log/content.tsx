import { FC, useState } from "react";
import { Button, Card, Col, List, Row, Select, Space, Spin, Tag } from "antd";
import { SettingContainerProps } from "@/components/setting-container";
import { useIsMobile } from "@/layouts/responsive";
import {
  useNotificationList,
  useReadAllNotification,
} from "@/services/notification";
import { DEFAULT_PAGE_SIZE } from "@/config";
import dayjs from "dayjs";

const NOTICE_TYPE_CONFIG: Record<number, { color: string; label: string }> = {
  1: { color: "blue", label: "提示" },
  2: { color: "orange", label: "警告" },
  3: { color: "red", label: "危险" },
};

const READ_OPTIONS = [
  { label: "未读", value: 0 },
  { label: "已读", value: 1 },
];

const TYPE_OPTIONS = [
  { label: "提示", value: 1 },
  { label: "警告", value: 2 },
  { label: "危险", value: 3 },
];

export const Content: FC<SettingContainerProps> = (props) => {
  const isMobile = useIsMobile();
  const { mutateAsync: readAll, isPending: isReadingAll } =
    useReadAllNotification();
  const [searchData, setSearchData] = useState<{
    isRead?: number;
    type?: number;
  }>({ isRead: 0 });
  const [page, setPage] = useState(1);

  const {
    data: listResp,
    isFetching,
    refetch,
  } = useNotificationList({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    ...searchData,
  });

  const items = listResp?.data?.items ?? [];
  const total = listResp?.data?.total ?? 0;

  const onReadAll = async () => {
    await readAll();
    refetch();
  };

  const renderContent = () => {
    return (
      <Spin spinning={isFetching}>
        <Row gutter={[20, 0]} className="mb-4">
          <Col span={12}>
            <Select
              size={isMobile ? "large" : "middle"}
              options={READ_OPTIONS}
              className="w-full"
              placeholder="是否已读"
              allowClear
              value={searchData.isRead}
              onChange={(v) => {
                setSearchData((s) => ({ ...s, isRead: v }));
                setPage(1);
              }}
            />
          </Col>
          <Col span={12}>
            <Select
              size={isMobile ? "large" : "middle"}
              options={TYPE_OPTIONS}
              className="w-full"
              placeholder="警报等级"
              allowClear
              value={searchData.type}
              onChange={(v) => {
                setSearchData((s) => ({ ...s, type: v }));
                setPage(1);
              }}
            />
          </Col>
        </Row>
        <List
          className="mb-4"
          pagination={{
            position: "bottom",
            align: "center",
            current: page,
            pageSize: DEFAULT_PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          locale={{ emptyText: <div className="mt-6">暂无通知</div> }}
          dataSource={items}
          renderItem={(item) => {
            const config = NOTICE_TYPE_CONFIG[item.type] ?? {
              color: "default",
              label: "未知",
            };
            return (
              <Card
                className="mt-3"
                type="inner"
                size="small"
                title={
                  <>
                    <Tag color={config.color}>{config.label}</Tag>
                    <span style={{ opacity: item.isRead ? 0.5 : 1 }}>
                      {item.title}
                    </span>
                  </>
                }
                extra={dayjs(item.date).format("YYYY-MM-DD HH:mm:ss")}
              >
                {item.content}
              </Card>
            );
          }}
        />
      </Spin>
    );
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className="flex flex-row-reverse">
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            <Button onClick={onReadAll} loading={isReadingAll} type="primary">
              已读全部
            </Button>
          </Space>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
        <Button onClick={props.onClose}>返回</Button>
        <Button onClick={onReadAll} loading={isReadingAll} type="primary">
          已读全部
        </Button>
      </div>
    </>
  );
};
