import { PATH_PACKAGE_JSON } from "@/config/path";
import type { AppInstance } from "@/types";
import { SchemaAppVersionResponse } from "@/types/app-config";

interface RegisterOptions {
  server: AppInstance;
}

export const registerController = (options: RegisterOptions) => {
  const { server } = options;
  server.post(
    "/config/version",
    {
      schema: {
        description: "获取应用版本号",
        tags: ["config"],
        response: {
          200: SchemaAppVersionResponse,
        },
      },
    },
    async () => {
      const { readFile } = await import("fs/promises");
      const packageJson = JSON.parse(
        await readFile(PATH_PACKAGE_JSON, "utf-8"),
      );
      return {
        version: packageJson.version,
        name: packageJson.name,
        repository: packageJson.repository?.url || packageJson.repository,
      };
    },
  );
};
