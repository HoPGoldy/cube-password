import { Context } from 'koa';

/**
 * 后端接口返回的数据格式
 */
export type AppResponse<T = any> = {
  code?: number;
  msg?: string;
  data?: T;
};

export type AppKoaContext = Context & {
  request: { body: Record<string, unknown> };
};
