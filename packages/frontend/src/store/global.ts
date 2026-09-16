import { useEffect } from "react";
import { APP_NAME } from "@/config";

/** 设置页面标题（document.title），卸载时恢复为应用名 */
export const usePageTitle = (title: string) => {
  useEffect(() => {
    document.title = title + " - " + APP_NAME;
  }, [title]);

  useEffect(() => {
    return () => {
      document.title = APP_NAME;
    };
  }, []);
};
