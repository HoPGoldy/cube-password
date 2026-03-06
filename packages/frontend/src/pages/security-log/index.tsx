import { FC, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Col, Form, List, Row, Select, Spin, Tag } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import {
  useNotificationList,
  useReadAllNotification,
} from "@/services/notification";
import { usePageTitle } from "@/store/global";
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

const SecurityLogPage: FC = () => {
  usePageTitle("安全日志");
  const navigate = useNavigate();
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
  const { mutateAsync: readAll } = useReadAllNotification();

  const items = listResp?.data?.items ?? [];
  const total = listResp?.data?.total ?? 0;

  const onReadAll = async () => {
    await readAll();
    refetch();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center">
          <Button
            icon={<LeftOutlined />}
            type="text"
            onClick={() => navigate("/settings")}
          />
          <span className="ml-2 text-lg font-medium">安全日志</span>
        </div>
        <Button size="small" onClick={onReadAll}>
          全部已读
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Filters */}
        <Row gutter={[16, 0]} className="mb-4">
          <Col span={12}>
            <Select
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

        <Spin spinning={isFetching}>
          <List
            pagination={{
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
      </div>
    </div>
  );
};

export default SecurityLogPage;
