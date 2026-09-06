import { createLocalInstance } from "@/utils/localstorage";

export const prefix = "$cube-password-";

/** 主题 */
export const localTheme = createLocalInstance(prefix + "theme");
