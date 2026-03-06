import { AppInstance } from "@/types";
import {
  SchemaUserSetThemeBody,
  SchemaUserStatisticResponse,
  SchemaUserCreatePwdSettingBody,
} from "@/types/user";
import { UserService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  userService: UserService;
}

export const registerUserController = (options: RegisterOptions) => {
  const { server, userService } = options;

  server.post(
    "/user/set-theme",
    {
      schema: {
        description: "设置主题",
        tags: ["user"],
        body: SchemaUserSetThemeBody,
      },
    },
    async (request) => {
      await userService.setTheme(request.body.theme);
      return {};
    },
  );

  server.post(
    "/user/statistic",
    {
      schema: {
        description: "应用统计",
        tags: ["user"],
        response: { 200: SchemaUserStatisticResponse },
      },
    },
    async () => {
      return await userService.getStatistic();
    },
  );

  server.post(
    "/user/create-pwd-setting",
    {
      schema: {
        description: "更新密码生成器配置",
        tags: ["user"],
        body: SchemaUserCreatePwdSettingBody,
      },
    },
    async (request) => {
      const { createPwdAlphabet, createPwdLength } = request.body;
      await userService.updateCreatePwdSetting(
        createPwdAlphabet,
        createPwdLength,
      );
      return {};
    },
  );
};
