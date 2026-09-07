import { FC, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, DatePicker, Empty, Input, Pagination, Spin } from "antd";
import type { Dayjs } from "dayjs";
import { LeftOutlined, SearchOutlined } from "@ant-design/icons";
import { usePageTitle } from "@/store/global";
import { DEFAULT_PAGE_SIZE } from "@/config";
import {
  ColorMultiplePicker,
  MARK_COLORS_MAP,
} from "@/components/color-picker";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { queryCertificateIndex } from "@/services/certificate";
import {
  stateCertMetaIndex,
  stateCertNameIndex,
} from "@/store/state-cert-name-index";
import { stateIsLoggedIn } from "@/store/user";
import { filterCertificates, type IndexedCertificate } from "./filter";

const SearchPage: FC = () => {
  usePageTitle("搜索凭证");
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<
    [string | undefined, string | undefined]
  >([undefined, undefined]);
  const [currentPage, setCurrentPage] = useState(1);

  const isLoggedIn = useAtomValue(stateIsLoggedIn);
  // 登录后拉全量密文索引并用 DEK 解密构建内存明文名称索引（服务端搜索已删除）
  const { isFetching } = useQuery({
    queryKey: ["certificateIndex"],
    queryFn: queryCertificateIndex,
    enabled: isLoggedIn,
    staleTime: Infinity,
  });
  const certNameIndex = useAtomValue(stateCertNameIndex);
  const certMetaIndex = useAtomValue(stateCertMetaIndex);

  const enabled = keyword.trim().length > 0 || selectedColors.length > 0;

  // 内存索引 → 全量条目，本地过滤 + 前端切片分页
  const allItems: IndexedCertificate[] = useMemo(() => {
    return Array.from(certNameIndex.entries()).map(([id, name]) => {
      const meta = certMetaIndex.get(id);
      return {
        id,
        name,
        icon: meta?.icon ?? null,
        markColor: meta?.markColor ?? null,
        updatedAt: meta?.updatedAt ?? "",
        groupId: meta?.groupId ?? 0,
      };
    });
  }, [certNameIndex, certMetaIndex]);

  const filteredItems = useMemo(
    () =>
      filterCertificates(allItems, {
        keyword,
        colors: selectedColors,
        startDate: dateRange[0],
        endDate: dateRange[1],
      }),
    [allItems, keyword, selectedColors, dateRange],
  );

  const total = filteredItems.length;
  const items = filteredItems.slice(
    (currentPage - 1) * DEFAULT_PAGE_SIZE,
    currentPage * DEFAULT_PAGE_SIZE,
  );

  // 过滤条件变化时回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedColors, dateRange]);

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
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          autoFocus
        />
      </div>

      <div className="px-4">
        <ColorMultiplePicker
          value={selectedColors}
          onChange={setSelectedColors}
        />
      </div>

      <div className="px-4 mt-2">
        <DatePicker.RangePicker
          value={
            dateRange[0] || dateRange[1]
              ? ([dateRange[0], dateRange[1]] as [
                  string | undefined,
                  string | undefined,
                ] as unknown as [Dayjs, Dayjs])
              : null
          }
          onChange={(dates) => {
            setDateRange([
              dates?.[0]?.format("YYYY-MM-DD"),
              dates?.[1]?.format("YYYY-MM-DD"),
            ]);
          }}
          allowEmpty={[true, true]}
          className="w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!enabled && (
          <Empty
            className="mt-[15vh]"
            description="输入关键字或选择颜色进行搜索"
          />
        )}

        {enabled && isFetching && (
          <div className="flex justify-center mt-[15vh]">
            <Spin />
          </div>
        )}

        {enabled && !isFetching && items.length === 0 && (
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
                  style={{
                    backgroundColor:
                      MARK_COLORS_MAP[item.markColor] || item.markColor,
                  }}
                />
              )}
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {item.updatedAt
                    ? dayjs(item.updatedAt).format("YYYY-MM-DD HH:mm")
                    : ""}
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
