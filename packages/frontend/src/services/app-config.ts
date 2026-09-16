import { queryClient, requestPost } from "./base";
import { useQuery } from "@tanstack/react-query";
import type { SchemaAppVersionResponseType } from "@shared-types/app-config";

export const useAppVersion = () => {
  const result = useQuery({
    queryKey: ["app-config/version"],
    queryFn: () => requestPost<SchemaAppVersionResponseType>("config/version"),
  });

  return {
    ...result,
    appVersion: result.data?.data,
  };
};
