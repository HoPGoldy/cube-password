/** 将多个 url 路径合并成一个，避免中间出现两个斜杠的情况 */
export const mergeUrl = (...path: string[]) => {
  return path.reduce((pre = "", cur = "") => {
    const endSlash = pre.endsWith("/");
    const startSlash = cur.startsWith("/");

    if (endSlash && startSlash) return pre + cur.substring(1);
    if (!endSlash && !startSlash) return pre + "/" + cur;
    return pre + cur;
  });
};
