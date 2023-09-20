import { AppKoaContext } from '@/types/global';
import dayjs from 'dayjs';
import { Next } from 'koa';
import { response } from '../utils';
import { LockDetail, LoginFailRecord } from '@/types/security';
import { queryIp } from './queryIp';
import { AppConfig } from '@/types/appConfig';

interface LoginLockOptions {
  excludePath?: string[];
  getAppConfig: () => AppConfig;
}

/**
 * 创建登录重试管理器
 * 每个 ip 同一天内最多失败三次
 */
export const createLoginLock = (props: LoginLockOptions) => {
  /**
   * 指定 ip 的失败登录日期记录
   */
  let loginFailRecords: LoginFailRecord[] = [];

  /**
   * 增加登录失败记录
   */
  const recordLoginFail = async (ip: string) => {
    const location = await queryIp(ip);
    loginFailRecords.push({ date: Date.now(), ip, location });

    return getLockDetail();
  };

  /**
   * 清空登录失败记录
   */
  const clearRecord = () => {
    loginFailRecords = [];
  };

  /**
   * 获取登录失败情况
   */
  const getLockDetail = (): LockDetail => {
    const { LOGIN_MAX_RETRY_COUNT } = props.getAppConfig();

    // 把一天前的记录清除掉
    loginFailRecords = loginFailRecords.filter((item) => {
      return dayjs(item.date).isSame(dayjs(), 'day');
    });

    return {
      loginFailure: loginFailRecords || [],
      retryNumber: LOGIN_MAX_RETRY_COUNT - loginFailRecords.length,
      isBanned: loginFailRecords.length >= LOGIN_MAX_RETRY_COUNT,
    };
  };

  /**
   * 登录锁定中间件
   * 用于在锁定时拦截所有中间件
   */
  const checkLoginDisable = async (ctx: AppKoaContext, next: Next) => {
    const isAccessPath = !!props.excludePath?.find((path) => ctx.url.endsWith(path));
    // 允许 excludePath 接口正常访问
    if (isAccessPath) return await next();

    try {
      const { isBanned } = getLockDetail();
      if (isBanned) throw new Error('登录失败次数过多');
      await next();
    } catch (e) {
      console.error(e);
      response(ctx, { code: 403, msg: '登录失败次数过多，请一天后再试' });
    }
  };

  return { recordLoginFail, checkLoginDisable, getLockDetail, clearRecord };
};

export type LoginLocker = ReturnType<typeof createLoginLock>;
