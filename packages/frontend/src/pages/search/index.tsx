import { FC, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pagination } from "antd";
import { usePageTitle } from "@/store/global";
import { DEFAULT_PAGE_SIZE } from "@/config";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { queryCertificateIndex } from "@/services/certificate";
import {
  stateCertMetaIndex,
  stateCertNameIndex,
} from "@/store/state-cert-name-index";
import { stateIsLoggedIn } from "@/store/user";
import { filterCertificates, type IndexedCertificate } from "./filter";
import { CertificateListItem } from "@/pages/certificate-list/components/certificate-list-item";
import { CertificateDetailModal } from "@/pages/certificate-list/components/certificate-detail";
import { ColorList, CubeSearchPage } from "@hopgoldy/cube-ui";

const SearchPage: FC = () => {
  usePageTitle("搜索凭证");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(
    () => searchParams.get("keyword") || "",
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(() => {
    const raw = searchParams.get("colors");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [detailId, setDetailId] = useState<number | undefined>();
  const [detailGroupId, setDetailGroupId] = useState(0);

  const isLoggedIn = useAtomValue(stateIsLoggedIn);
  const { isFetching } = useQuery({
    queryKey: ["certificateIndex"],
    queryFn: queryCertificateIndex,
    enabled: isLoggedIn,
    staleTime: Infinity,
  });
  const certNameIndex = useAtomValue(stateCertNameIndex);
  const certMetaIndex = useAtomValue(stateCertMetaIndex);

  const hasQuery = keyword.trim().length > 0 || selectedColors.length > 0;

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

  const filteredItems = useMemo(() => {
    if (!hasQuery) return [];
    return filterCertificates(allItems, {
      keyword,
      colors: selectedColors,
    });
  }, [allItems, keyword, selectedColors, hasQuery]);

  const total = filteredItems.length;
  const items = filteredItems.slice(
    (currentPage - 1) * DEFAULT_PAGE_SIZE,
    currentPage * DEFAULT_PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedColors]);

  const onKeywordSearch = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
    if (value) searchParams.set("keyword", value);
    else searchParams.delete("keyword");
    setSearchParams(searchParams, { replace: true });
  };

  const onSelectColor = (colorCode: string) => {
    const newColors = colorCode ? [colorCode] : [];
    setSelectedColors(newColors);
    setCurrentPage(1);
    if (newColors.length > 0) searchParams.set("colors", newColors.join(","));
    else searchParams.delete("colors");
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <>
      <CubeSearchPage
        keyword={keyword}
        placeholder="请输入凭证名称，回车搜索"
        onSearch={onKeywordSearch}
        onBack={() => navigate(-1)}
        desktopHeaderLeft="搜索凭证"
        pending={!hasQuery}
        loading={hasQuery && isFetching}
        empty={hasQuery && !isFetching && items.length === 0}
        emptyTitle="没有找到相关凭证"
        emptyHint="请尝试其他关键字"
        pendingHint="可使用关键词和颜色进行搜索"
        filters={
          <ColorList value={selectedColors[0] || ""} onChange={onSelectColor} />
        }
        mobileFilterTitle="凭证筛选"
      >
        {items.map((item) => (
          <CertificateListItem
            key={item.id}
            layout="fill"
            detail={{
              id: item.id,
              displayName: item.name,
              markColor: item.markColor,
              icon: item.icon,
              updatedAt: item.updatedAt,
            }}
            onClick={() => {
              setDetailGroupId(item.groupId);
              setDetailId(item.id);
            }}
          />
        ))}
        {total > DEFAULT_PAGE_SIZE && (
          <Pagination
            current={currentPage}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            onChange={setCurrentPage}
            showSizeChanger={false}
          />
        )}
      </CubeSearchPage>

      <CertificateDetailModal
        groupId={detailGroupId}
        detailId={detailId}
        onClose={() => setDetailId(undefined)}
      />
    </>
  );
};

export default SearchPage;
