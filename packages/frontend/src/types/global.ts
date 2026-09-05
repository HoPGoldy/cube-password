/**
 * 后端接口返回的数据格式
 */
export type AppResponse<T = any> = {
  code?: number;
  message?: string;
  success: boolean;
  data?: T;
};
