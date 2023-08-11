import { DatabaseAccessor } from '@/server/lib/sqlite';
import { SecurityNoticeType } from '@/types/security';

interface Props {
  db: DatabaseAccessor;
}

export const createSecurityService = (props: Props) => {
  const { db } = props;

  /**
   * 发布一条新的安全通知
   */
  const insertSecurityNotice = async (type: SecurityNoticeType, title: string, content: string) => {
    console.log('创建安全通知', type, title, content);
  };

  return { insertSecurityNotice };
};

export type SecurityService = ReturnType<typeof createSecurityService>;
