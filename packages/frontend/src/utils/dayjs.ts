import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

/** 初始化 dayjs（当前仅设置中文 locale；数字格式化无需任何插件） */
export const initDayjs = () => {
  dayjs.locale("zh-cn");
};
