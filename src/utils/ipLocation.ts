/**
 * 判断两个位置字符串是否为同一区域
 * 由于最后一位是网络提供商（例如电信、移动），所以需要剔除
 */
export const isSameLocation = (location1?: string, location2?: string) => {
  if (!location1 || !location2) return false;
  return location1.split('|').slice(0, 3).join('|') === location2.split('|').slice(0, 3).join('|');
};

/**
 * 把后端存储的区域字符串转换为阅读友好形式
 */
export const formatLocation = (location?: string) => {
  if (!location) return '未知地点';
  return location
    .split('|')
    .filter((str) => str !== '0')
    .join(', ');
};
