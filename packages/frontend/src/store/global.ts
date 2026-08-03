import { atom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { APP_NAME } from "@/config";

/**
 * 应用顶部的标题栏 title
 */
export const statePageTitle = atom<string>("");

export const usePageTitle = (title: string) => {
  const setCurrentPageTitle = useSetAtom(statePageTitle);

  useEffect(() => {
    setCurrentPageTitle(title);
    document.title = title + " - " + APP_NAME;
  }, [title]);

  useEffect(() => {
    return () => {
      setCurrentPageTitle("");
      document.title = APP_NAME;
    };
  }, []);
};
