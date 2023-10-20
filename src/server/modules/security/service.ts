import { PAGE_SIZE } from '@/config';
import { DatabaseAccessor } from '@/server/lib/sqlite';
import { PageSearchFilter, QueryListResp } from '@/types/global';
import { SecurityNoticeType } from '@/types/security';

interface Props {
  db: DatabaseAccessor;
}

export const createSecurityService = (props: Props) => {
  const { db } = props;

  /** 发布一条新的安全通知 */
  const insertSecurityNotice = async (type: SecurityNoticeType, title: string, content: string) => {
    console.log('创建安全通知', type, title, content);
    const result = await db
      .notice()
      .insert({ type, title, content, date: new Date().valueOf(), isRead: false });

    return result;
  };

  /** 查询通知分组列表 */
  const queryNoticeList = async (query: PageSearchFilter) => {
    const { 'count(*)': count } = await (db.notice().count().first() as any);
    const list = await db
      .notice()
      .select()
      .orderBy('date', 'asc')
      .limit(PAGE_SIZE)
      .offset((query.page - 1) * PAGE_SIZE);

    const data: QueryListResp = { rows: list, total: count };
    return { code: 200, data };
  };

  /** 已读全部 */
  const readAllNotice = async () => {
    await db.notice().select('isRead').where('isRead', 0).update({ isRead: true });
    return { code: 200 };
  };

  /** 删除全部 */
  const removeAllNotice = async () => {
    await db.notice().delete();
    return { code: 200 };
  };

  return { insertSecurityNotice, queryNoticeList, readAllNotice, removeAllNotice };
};

export type SecurityService = ReturnType<typeof createSecurityService>;
