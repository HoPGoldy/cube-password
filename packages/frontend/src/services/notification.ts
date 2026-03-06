import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, requestPost } from "./base";
import type {
  SchemaNotificationListBodyType,
  SchemaNotificationListResponseType,
} from "@shared-types/notification";

/** 通知列表 */
export const useNotificationList = (data: SchemaNotificationListBodyType) => {
  return useQuery({
    queryKey: ["notificationList", data],
    queryFn: () =>
      requestPost<SchemaNotificationListResponseType>(
        "notification/list",
        data,
      ),
    refetchOnWindowFocus: false,
  });
};

/** 标记全部已读 */
export const useReadAllNotification = () => {
  return useMutation({
    mutationFn: () => {
      return requestPost("notification/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationList"] });
    },
  });
};

/** 删除全部 */
export const useRemoveAllNotification = () => {
  return useMutation({
    mutationFn: () => {
      return requestPost("notification/remove-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationList"] });
    },
  });
};
