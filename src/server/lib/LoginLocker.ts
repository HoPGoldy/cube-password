import { AppKoaContext } from '@/types/global';
import dayjs from 'dayjs';
import { Next } from 'koa';
import { response } from '../utils';
import { LoginFailRecord } from '@/types/security';
import { queryIp } from './queryIp';

export interface LoginRecordDetail {
  /**
   * 要显示的错误登录信息
   * 不一定是所有的，一般都是今天的错误信息
   */
  records: string[];
  /**
   * 是否被锁定
   */
  disable: boolean;
  /**
   * 是否无限期锁定
   */
  dead: boolean;
}

interface LoginLockOptions {
  excludePath?: string[];
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

    // 把一天前的记录清除掉
    loginFailRecords = loginFailRecords.filter((item) => {
      return dayjs(item.date).isSame(dayjs(), 'day');
    });

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
  const getLockDetail = (): LoginFailRecord[] => {
    return loginFailRecords || [];
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
      if (getLockDetail().length >= 3) throw new Error('登录失败次数过多');
      await next();
    } catch (e) {
      console.error(e);
      response(ctx, { code: 403, msg: '登录失败次数过多，请一天后再试' });
    }
  };

  return { recordLoginFail, checkLoginDisable, getLockDetail, clearRecord };
};

export type LoginLocker = ReturnType<typeof createLoginLock>;
