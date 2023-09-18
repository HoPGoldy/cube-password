import {
  AppTheme,
  UserStorage,
  LoginSuccessResp,
  RegisterReqData,
  AppStatistics,
  ChangePasswordReqData,
} from '@/types/user';
import { AppResponse } from '@/types/global';
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH, STATUS_CODE } from '@/config';
import { aes, aesDecrypt, getAesMeta, sha } from '@/utils/crypto';
import { LoginLocker } from '@/server/lib/LoginLocker';
import { nanoid } from 'nanoid';
import { DatabaseAccessor } from '@/server/lib/sqlite';
import { SecurityService } from '../security/service';
import { SecurityNoticeType } from '@/types/security';
import { queryIp } from '@/server/lib/queryIp';
import { formatLocation, isSameLocation } from '@/server/utils';
import { authenticator } from 'otplib';
import { GroupService } from '../group/service';
import { SessionController } from '@/server/lib/auth';
import { LockType } from '@/types/group';

interface Props {
  loginLocker: LoginLocker;
  startSession: SessionController['start'];
  stopSession: SessionController['stop'];
  getUserInfo: SessionController['getUserInfo'];
  getChallengeCode: () => string | undefined;
  addGroup: GroupService['addGroup'];
  addUnlockedGroup: SessionController['addUnlockedGroup'];
  queryGroupList: GroupService['queryGroupList'];
  insertSecurityNotice: SecurityService['insertSecurityNotice'];
  db: DatabaseAccessor;
}

export const createUserService = (props: Props) => {
  const {
    loginLocker,
    startSession,
    stopSession,
    addGroup,
    queryGroupList,
    getChallengeCode,
    getUserInfo,
    insertSecurityNotice,
    addUnlockedGroup,
    db,
  } = props;

  const loginFail = async (ip: string, msg = '账号或密码错误') => {
    const lockInfo = await loginLocker.recordLoginFail(ip);
    const retryNumber = 3 - lockInfo.length;
    const message = retryNumber > 0 ? `将在 ${retryNumber} 次后锁定登录` : '账号已被锁定';

    const location = await queryIp(ip);
    insertSecurityNotice(
      SecurityNoticeType.Warning,
      '异地登录',
      `${ip}（${formatLocation(location)}）在登陆时输入了错误的密码，请检查是否为本人操作。`,
    );

    return { code: STATUS_CODE.LOGIN_PASSWORD_ERROR, msg: `${msg}，${message}` };
  };

  /**
   * 登录
   */
  const login = async (password: string, ip: string, code?: string): Promise<AppResponse> => {
    const userStorage = await db.user().select().first();
    if (!userStorage) return loginFail(ip);

    const challengeCode = getChallengeCode();
    if (!challengeCode) {
      insertSecurityNotice(
        SecurityNoticeType.Danger,
        '未授权状态下进行登录操作',
        '发起了一次非法登录，已被拦截。',
      );
      loginLocker.recordLoginFail(ip);
      return { code: 401, msg: '挑战码错误' };
    }

    const {
      passwordHash,
      defaultGroupId,
      initTime,
      theme,
      commonLocation,
      totpSecret,
      createPwdAlphabet = DEFAULT_PASSWORD_ALPHABET,
      createPwdLength = DEFAULT_PASSWORD_LENGTH,
    } = userStorage;
    const currentLocation = await queryIp(ip);

    // 本次登录地点和常用登录地不同
    if (commonLocation && !isSameLocation(commonLocation, currentLocation)) {
      // 没有绑定动态验证码
      if (!totpSecret) {
        const beforeLocation = formatLocation(commonLocation);
        insertSecurityNotice(
          SecurityNoticeType.Warning,
          '异地登录',
          `${ip}（${formatLocation(
            currentLocation,
          )}）进行了一次异地登录，上次登录地为${beforeLocation}，请检查是否为本人操作。`,
        );
      }
      // 绑定了动态验证码
      else {
        if (!code) {
          return { code: STATUS_CODE.NEED_CODE, msg: '非常用地区登录，请输入动态验证码' };
        }

        const isValid = authenticator.verify({ token: code, secret: totpSecret });
        if (!isValid) {
          return { code: 400, msg: '动态验证码错误' };
        }
      }
    }

    if (password !== sha(passwordHash + challengeCode)) return loginFail(ip);

    // 用户每次重新进入页面都会刷新 token
    const session = startSession();
    const groupList = await queryGroupList();
    groupList.data.forEach((group) => {
      if (group.lockType !== LockType.None) return;
      addUnlockedGroup(group.id);
    });

    const data: LoginSuccessResp = {
      token: session.token,
      replayAttackSecret: session.replayAttackSecret,
      theme,
      initTime,
      groups: groupList.data,
      hasNotice: false,
      withTotp: !!totpSecret,
      defaultGroupId,
      createPwdAlphabet,
      createPwdLength,
    };

    loginLocker.clearRecord();
    return { code: 200, data };
  };

  /**
   * 登出
   */
  const logout = async () => {
    stopSession();
    return { code: 200 };
  };

  /**
   * 创建管理员
   */
  const createAdmin = async (data: RegisterReqData): Promise<AppResponse> => {
    const [{ ['count(*)']: userCount }] = await db.user().count();
    if (+userCount > 0) {
      return { code: 400, msg: '用户已存在' };
    }

    const addGroupResp = await addGroup({ name: '默认分组', lockType: LockType.None });
    if (addGroupResp.code !== 200) {
      return addGroupResp;
    }

    const initStorage: Omit<UserStorage, 'id'> = {
      passwordHash: data.code,
      passwordSalt: data.salt,
      initTime: Date.now(),
      theme: AppTheme.Light,
      defaultGroupId: addGroupResp.data?.newId,
    };

    await db.user().insert(initStorage);
    return { code: 200 };
  };

  /**
   * 修改密码 - 更新密码
   * aes 加密，密钥为(sha(主密码 + 盐) + 挑战码 + sessionToken + totp)
   *
   * @param changePwdData 被前端加密的修改密码信息
   */
  const changePassword = async (changePwdDataStr: string): Promise<AppResponse> => {
    const challengeCode = getChallengeCode();
    if (!challengeCode) {
      insertSecurityNotice(
        SecurityNoticeType.Danger,
        '重置密码',
        '未授权状态下进行密码重置操作，已被拦截。',
      );
      return { code: 401, msg: '挑战码错误' };
    }

    const userStorage = await db.user().select().first();
    if (!userStorage) {
      return { code: 400, msg: '用户不存在' };
    }

    const userInfo = getUserInfo();
    const { passwordHash, totpSecret } = userStorage;
    const totpCode = totpSecret ? authenticator.generate(totpSecret) : '';
    const postKey = passwordHash + challengeCode + userInfo.token + totpCode;
    // console.log('🚀 ~ file: service.ts:209 ~ changePassword ~ postKey:', postKey);

    const { key, iv } = getAesMeta(postKey);
    const changeData = aesDecrypt(changePwdDataStr, key, iv);
    if (!changeData) return { code: 400, msg: '无效的密码修改凭证' };

    const { oldPassword, newPassword } = JSON.parse(changeData) as ChangePasswordReqData;
    const oldMeta = getAesMeta(oldPassword);
    const newMeta = getAesMeta(newPassword);

    try {
      await db.knex.transaction(async (trx) => {
        const allCertificates = await trx('certificates').select();

        // 重新加密所有凭证
        const updateContents = allCertificates.map((certificate) => {
          const newContent = aesDecrypt(certificate.content, oldMeta.key, oldMeta.iv);
          const newContentStr = aes(newContent, newMeta.key, newMeta.iv);

          return trx('certificates').update('content', newContentStr).where('id', certificate.id);
        });

        await Promise.all(updateContents);

        const passwordSalt = nanoid();
        // 把主密码信息更新上去
        await trx('users')
          .update('passwordHash', sha(passwordSalt + newPassword))
          .update('passwordSalt', passwordSalt)
          .where('id', userStorage.id);
      });

      return { code: 200 };
    } catch (e) {
      console.error(e);
      return { code: 500, msg: '修改密码失败' };
    }
  };

  /**
   * 设置应用主题色
   */
  const setTheme = async (theme: AppTheme) => {
    const userStorage = await db.user().select().first();
    if (!userStorage) {
      return { code: 400, msg: '用户不存在' };
    }

    await db.user().update('theme', theme).where('id', userStorage.id);
    return { code: 200 };
  };

  /**
   * 应用统计
   */
  const getCount = async () => {
    const [groupCount] = await db.group().count();
    const [certificateCount] = await db.certificate().count();

    const data: AppStatistics = {
      groupCount: groupCount['count(*)'] as number,
      certificateCount: certificateCount['count(*)'] as number,
    };
    return { code: 200, data };
  };

  /**
   * 设置新密码的生成参数
   * 置空以设置为默认
   *
   * @param alphabet 密码生成的字符集
   * @param length 密码生成的长度
   */
  const setCreatePwdSetting = async (alphabet: string, length: number) => {
    const userStorage = await db.user().select().first();
    if (!userStorage) {
      return { code: 400, msg: '用户不存在' };
    }

    await db
      .user()
      .update('createPwdAlphabet', alphabet)
      .update('createPwdLength', length)
      .where('id', userStorage.id);
    return { code: 200 };
  };

  return { login, logout, createAdmin, changePassword, setTheme, getCount, setCreatePwdSetting };
};

export type UserService = ReturnType<typeof createUserService>;
