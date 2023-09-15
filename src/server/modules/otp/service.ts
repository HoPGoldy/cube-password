import { DatabaseAccessor } from '@/server/lib/sqlite';
import { createOTP } from '@/server/lib/auth';
import { RegisterOTPInfo } from '@/types/otp';
import { authenticator } from 'otplib';
import { SecurityNoticeType } from '@/types/security';
import { SecurityService } from '../security/service';
import { sha } from '@/utils/crypto';
import { LockType } from '@/types/group';

interface Props {
  db: DatabaseAccessor;
  getChallengeCode: () => string | undefined;
  insertSecurityNotice: SecurityService['insertSecurityNotice'];
}

export const createOtpService = (props: Props) => {
  const { db, getChallengeCode, insertSecurityNotice } = props;

  // 五分钟超时
  const optSecretManager = createOTP(1000 * 60 * 5);

  /**
   * 获取 OTP 令牌信息
   * 如果未绑定令牌，则返回绑定二维码 base64
   */
  const getOtpQrcode = async () => {
    const userStorage = await db.user().select().first();
    if (!userStorage) return { code: 401, msg: '找不到用户信息' };

    const { totpSecret } = userStorage;
    if (totpSecret) {
      const data: RegisterOTPInfo = { registered: true };
      return { code: 200, data };
    }

    const secret = authenticator.generateSecret();
    optSecretManager.create('default', secret);

    const qrcodeUrl = authenticator.keyuri('main password', 'cube-password', secret);
    const data: RegisterOTPInfo = { registered: false, qrCode: qrcodeUrl };
    return { code: 200, data };
  };

  /**
   * 绑定 otp 令牌
   *
   * @param code 动态令牌
   */
  const bindOtp = async (code: string) => {
    const userStorage = await db.user().select().first();
    if (!userStorage) return { code: 401, msg: '找不到用户信息' };

    const { totpSecret } = userStorage;
    if (totpSecret) {
      return { code: 400, msg: '已绑定令牌' };
    }

    const secret = optSecretManager.pop('default');
    if (!secret) {
      return { code: 400, msg: '令牌已失效，请重新绑定' };
    }

    const codeConfirmed = authenticator.check(code, secret);
    if (!codeConfirmed) {
      return { code: 400, msg: '验证码错误，请重新绑定' };
    }

    await db.user().update('totpSecret', secret).where('id', userStorage.id);

    return { code: 200 };
  };

  /**
   * 解绑 otp 令牌
   *
   * @param code 动态令牌
   */
  const removeOtp = async (password: string, code: string) => {
    const challengeCode = getChallengeCode();
    if (!challengeCode) {
      insertSecurityNotice(
        SecurityNoticeType.Danger,
        'opt 解绑',
        '未授权状态下进行 otp 令牌解绑操作，已被拦截。',
      );
      return { code: 401, msg: '挑战码错误' };
    }

    const totpGroups = await db.group().select('name').where('lockType', LockType.Totp);
    if (totpGroups.length > 0) {
      const groupNames = totpGroups.map((i) => `“${i.name}”`).join('，');
      const msg = `分组${groupNames}正在使用动态验证码，请先移除分组密码`;
      return { code: 400, msg };
    }

    const userStorage = await db.user().select().first();
    if (!userStorage) return { code: 500, msg: '找不到用户信息' };

    const { totpSecret, passwordHash } = userStorage;
    if (!totpSecret) {
      return { code: 400, msg: '未绑定令牌' };
    }

    if (password !== sha(passwordHash + challengeCode)) {
      return { code: 400, msg: '密码错误' };
    }

    const codeConfirmed = authenticator.check(code, totpSecret);
    if (!codeConfirmed) {
      return { code: 400, msg: '验证码已过期，请重新输入' };
    }

    await db.user().update('totpSecret', '').where('id', userStorage.id);
    return { code: 200 };
  };

  return { getOtpQrcode, bindOtp, removeOtp };
};

export type OtpService = ReturnType<typeof createOtpService>;
