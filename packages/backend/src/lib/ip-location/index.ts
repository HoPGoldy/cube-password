import path from "path";
import { loadContentFromFile, newWithBuffer, isValidIp } from "./ip2region";

const dbPath = path.join(__dirname, "../../../storage/ip2region.xdb");
const buffer = loadContentFromFile(dbPath);
const searcher = newWithBuffer(buffer);

/**
 * 查询 IPv4 地理位置
 * @returns "国家|区域|省份|城市|服务提供商"
 */
export const queryIp = (ip?: string): string => {
  try {
    if (!ip) return "";
    const pureIp = ip.startsWith("::ffff:") ? ip.replace("::ffff:", "") : ip;
    if (!isValidIp(pureIp)) return "";

    const data = searcher.search(pureIp);
    return data.region ?? "";
  } catch (e) {
    console.error("IP 地址查询失败", e);
    return "";
  }
};

/**
 * 判断两个位置是否同一区域（忽略网络提供商）
 */
export const isSameLocation = (
  location1?: string,
  location2?: string,
): boolean => {
  if (!location1 || !location2) return false;
  return (
    location1.split("|").slice(0, 3).join("|") ===
    location2.split("|").slice(0, 3).join("|")
  );
};

/**
 * 格式化位置字符串为可读形式
 */
export const formatLocation = (location?: string): string => {
  if (!location) return "未知地点";
  return location
    .split("|")
    .filter((str) => str !== "0")
    .join(", ");
};
