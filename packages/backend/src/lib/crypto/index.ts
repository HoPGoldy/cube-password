import {
  createHash,
  timingSafeEqual as nodeTimingSafeEqual,
} from "node:crypto";

/**
 * 获取 sha512 hash（大写 hex）
 */
export const sha512 = (str: string) => {
  return createHash("sha512").update(str, "utf8").digest("hex").toUpperCase();
};

/**
 * 常数时间字符串比较，防止逐字节短路比对泄露匹配前缀长度
 * - 长度不等时先对两个输入各做一次完整虚拟比较再返回 false，
 *   使比较耗时只取决于最大输入长度，不泄露长度信息
 * - 输入应为同源编码的字符串（本项目内均为 sha512 的大写 hex 输出）
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // 长度不等：对两者各做一次全量比较以抹平常数时间的统计特征，然后返回 false
    nodeTimingSafeEqual(bufA, bufA);
    nodeTimingSafeEqual(bufB, bufB);
    return false;
  }
  return nodeTimingSafeEqual(bufA, bufB);
};
