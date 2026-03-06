import { AppInstance } from "@/types";
import {
  SchemaNotificationListBody,
  SchemaNotificationListResponse,
} from "@/types/notification";
import { NotificationService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  notificationService: NotificationService;
}

export const registerNotificationController = (options: RegisterOptions) => {
  const { server, notificationService } = options;

  server.post(
    "/notification/list",
    {
      schema: {
        description: "通知列表",
        tags: ["notification"],
        body: SchemaNotificationListBody,
        response: { 200: SchemaNotificationListResponse },
      },
    },
    async (request) => {
      return await notificationService.list(request.body);
    },
  );

  server.post(
    "/notification/read-all",
    {
      schema: {
        description: "全部标记已读",
        tags: ["notification"],
      },
    },
    async () => {
      await notificationService.readAll();
      return {};
    },
  );

  server.post(
    "/notification/remove-all",
    {
      schema: {
        description: "清空所有通知",
        tags: ["notification"],
      },
    },
    async () => {
      await notificationService.removeAll();
      return {};
    },
  );
};
