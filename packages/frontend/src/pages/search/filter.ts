/** 内存索引条目（本地搜索的过滤对象） */
export interface IndexedCertificate {
  id: number;
  name: string;
  icon: string | null;
  markColor: string | null;
  updatedAt: string;
  groupId: number;
}

/** 名称包含匹配（大小写不敏感，空关键字视为命中） */
export const matchKeyword = (name: string, keyword: string): boolean => {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return name.toLowerCase().includes(kw);
};

/**
 * 内存索引本地过滤（元数据加密：搜索不再走服务端接口）
 * 名称包含 + 颜色筛选，按 updatedAt 倒序
 */
export const filterCertificates = (
  items: IndexedCertificate[],
  params: {
    keyword?: string;
    colors?: string[];
  },
): IndexedCertificate[] => {
  const { keyword, colors } = params;
  return items
    .filter((item) => matchKeyword(item.name, keyword ?? ""))
    .filter(
      (item) =>
        !colors ||
        colors.length === 0 ||
        (item.markColor != null && colors.includes(item.markColor)),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};
