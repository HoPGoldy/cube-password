import knex from 'knex';
import { UserStorage } from '@/types/user';
import { TABLE_NAME } from '@/config';
import { CertificateGroupStorage } from '@/types/group';
import { CertificateStorage } from '@/types/certificate';
import { SecurityNoticeStorage } from '@/types/security';

declare module 'knex/types/tables' {
  interface Tables {
    users: UserStorage;
    certificates: CertificateStorage;
    group: CertificateGroupStorage;
  }
}

interface Props {
  dbPath: string;
}

export const createDb = (props: Props) => {
  const sqliteDb = knex({
    client: 'sqlite3',
    connection: { filename: props.dbPath },
    useNullAsDefault: true,
  });

  // 用户表
  sqliteDb.schema.hasTable(TABLE_NAME.USER).then((exists) => {
    if (exists) return;
    return sqliteDb.schema.createTable(TABLE_NAME.USER, (t) => {
      t.increments('id').primary();
      t.string('passwordHash').notNullable();
      t.string('passwordSalt').notNullable();
      t.timestamp('initTime').notNullable();
      t.string('theme').notNullable();
      t.integer('defaultGroupId');
      t.string('commonLocation');
      t.string('totpSecret');
      t.string('createPwdAlphabet');
      t.string('createPwdLength');
    });
  });

  // 凭证表
  sqliteDb.schema.hasTable(TABLE_NAME.CERTIFICATE).then((exists) => {
    if (exists) return;
    return sqliteDb.schema.createTable(TABLE_NAME.CERTIFICATE, (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.integer('groupId').notNullable();
      t.timestamp('createTime').notNullable();
      t.timestamp('updateTime').notNullable();
      t.text('content').notNullable();
      t.integer('order');
      t.string('markColor');
    });
  });

  // 分组表
  sqliteDb.schema.hasTable(TABLE_NAME.GROUP).then((exists) => {
    if (exists) return;
    return sqliteDb.schema.createTable(TABLE_NAME.GROUP, (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.integer('order');
      t.string('lockType');
      t.string('passwordHash');
      t.string('passwordSalt');
    });
  });

  // 安全通知表
  sqliteDb.schema.hasTable(TABLE_NAME.NOTIFICATION).then((exists) => {
    if (exists) return;
    return sqliteDb.schema.createTable(TABLE_NAME.NOTIFICATION, (t) => {
      t.increments('id').primary();
      t.string('title').notNullable();
      t.text('content').notNullable();
      t.timestamp('date').notNullable();
      t.integer('type').notNullable();
      t.boolean('isRead');
    });
  });

  return {
    knex: sqliteDb,
    user: () => sqliteDb<UserStorage>(TABLE_NAME.USER),
    certificate: () => sqliteDb<CertificateStorage>(TABLE_NAME.CERTIFICATE),
    group: () => sqliteDb<CertificateGroupStorage>(TABLE_NAME.GROUP),
    notice: () => sqliteDb<SecurityNoticeStorage>(TABLE_NAME.NOTIFICATION),
  };
};

export type DatabaseAccessor = ReturnType<typeof createDb>;
