import { useMutation } from "@tanstack/react-query";
import { requestPost } from "./base";
import type {
  SchemaUserSetThemeBodyType,
  SchemaUserStatisticResponseType,
  SchemaUserCreatePwdSettingBodyType,
} from "@shared-types/user";

/** 设置主题 */
export const useSetTheme = () => {
  return useMutation({
    mutationFn: (data: SchemaUserSetThemeBodyType) => {
      return requestPost("user/set-theme", data);
    },
  });
};

/** 获取统计 */
export const useStatistic = () => {
  return useMutation({
    mutationFn: () => {
      return requestPost<SchemaUserStatisticResponseType>("user/statistic");
    },
  });
};

/** 更新密码生成配置 */
export const useUpdateCreatePwdSetting = () => {
  return useMutation({
    mutationFn: (data: SchemaUserCreatePwdSettingBodyType) => {
      return requestPost("user/create-pwd-setting", data);
    },
  });
};
