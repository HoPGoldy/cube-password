import { FC, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Col, Empty, Input, Pagination, Row, Spin } from "antd";
import { LeftOutlined, SearchOutlined } from "@ant-design/icons";
import { useSearchCertificate } from "@/services/certificate";
import { usePageTitle } from "@/store/global";
import { DEFAULT_PAGE_SIZE } from "@/config";
import dayjs from "dayjs";

const SearchPage: FC = () => {
  usePageTitle("搜索凭证");
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const enabled = keyword.trim().length > 0;
  const { data: searchResult, isLoading } = useSearchCertificate(
    { keyword, page: currentPage, pageSize: DEFAULT_PAGE_SIZE },
    enabled,
  );

  const items = searchResult?.data?.items ?? [];
  const total = searchResult?.data?.total ?? 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center p-3 border-b border-gray-200">
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => navigate(-1)}
        />
        <Input
          className="flex-1 mx-2"
          placeholder="搜索凭证名称..."
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setCurrentPage(1);
          }}
          allowClear
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!enabled && (
          <Empty className="mt-[15vh]" description="输入关键字开始搜索" />
        )}

        {enabled && isLoading && (
          <div className="flex justify-center mt-[15vh]">
            <Spin />
          </div>
        )}

        {enabled && !isLoading && items.length === 0 && (
          <Empty className="mt-[15vh]" description="未找到匹配的凭证" />
        )}

        {items.map((item) => (
          <Card
            key={item.id}
            size="small"
            className="mb-3 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/group/${item.groupId}`)}
          >
            <div className="flex items-center">
              {item.markColor && (
                <div
                  className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                  style={{ backgroundColor: item.markColor }}
                />
              )}
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {dayjs(item.updatedAt).format("YYYY-MM-DD HH:mm")}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {total > DEFAULT_PAGE_SIZE && (
          <div className="flex justify-center mt-4">
            <Pagination
              current={currentPage}
              total={total}
              pageSize={DEFAULT_PAGE_SIZE}
              onChange={setCurrentPage}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
