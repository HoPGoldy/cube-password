import { describe, expect, it } from "vitest";
import {
  filterCertificates,
  matchDateRange,
  matchKeyword,
  type IndexedCertificate,
} from "./filter";

const makeItem = (
  overrides: Partial<IndexedCertificate> = {},
): IndexedCertificate => ({
  id: 1,
  name: "GitHub",
  icon: null,
  markColor: null,
  updatedAt: "2026-02-01T10:00:00.000Z",
  groupId: 1,
  ...overrides,
});

describe("matchKeyword", () => {
  it("空关键字命中所有名称", () => {
    expect(matchKeyword("任意名称", "")).toBe(true);
    expect(matchKeyword("任意名称", "   ")).toBe(true);
  });

  it("包含匹配，大小写不敏感", () => {
    expect(matchKeyword("GitHub Account", "git")).toBe(true);
    expect(matchKeyword("GitHub Account", "HUB ACC")).toBe(true);
    expect(matchKeyword("招商银行", "商")).toBe(true);
    expect(matchKeyword("GitHub", "gitlab")).toBe(false);
  });
});

describe("matchDateRange", () => {
  const updatedAt = "2026-02-15T08:30:00.000Z";

  it("无边界时命中", () => {
    expect(matchDateRange(updatedAt)).toBe(true);
  });

  it("闭区间边界（当天起止均含）", () => {
    expect(matchDateRange(updatedAt, "2026-02-15", "2026-02-15")).toBe(true);
    expect(matchDateRange(updatedAt, "2026-02-16")).toBe(false);
    expect(matchDateRange(updatedAt, undefined, "2026-02-14")).toBe(false);
  });
});

describe("filterCertificates", () => {
  const items: IndexedCertificate[] = [
    makeItem({
      id: 1,
      name: "GitHub",
      markColor: "c11",
      updatedAt: "2026-02-01T00:00:00.000Z",
    }),
    makeItem({
      id: 2,
      name: "GitLab",
      markColor: "c6",
      updatedAt: "2026-03-01T00:00:00.000Z",
    }),
    makeItem({
      id: 3,
      name: "招商银行",
      markColor: "c11",
      updatedAt: "2026-01-15T00:00:00.000Z",
    }),
    makeItem({
      id: 4,
      name: "公司 VPN",
      markColor: null,
      updatedAt: "2026-02-20T00:00:00.000Z",
    }),
  ];

  it("名称包含过滤（大小写不敏感）", () => {
    const result = filterCertificates(items, { keyword: "git" });
    expect(result.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it("颜色筛选：无颜色的条目仅在未选颜色时可见", () => {
    const result = filterCertificates(items, { colors: ["c11"] });
    expect(result.map((i) => i.id).sort()).toEqual([1, 3]);
  });

  it("日期范围过滤", () => {
    const result = filterCertificates(items, {
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    expect(result.map((i) => i.id).sort()).toEqual([1, 4]);
  });

  it("组合过滤（关键字 + 颜色）", () => {
    const result = filterCertificates(items, {
      keyword: "git",
      colors: ["c6"],
    });
    expect(result.map((i) => i.id)).toEqual([2]);
  });

  it("按 updatedAt 倒序", () => {
    const result = filterCertificates(items, {});
    expect(result.map((i) => i.id)).toEqual([2, 4, 1, 3]);
  });
});
