import { LoginLocker } from '@/server/lib/LoginLocker';
import { DatabaseAccessor } from '@/server/lib/sqlite';
import { AppConfig, AppConfigResp, ColorConfig } from '@/types/appConfig';

interface Props {
  getAppConfig: () => AppConfig;
  getLockDetail: LoginLocker['getLockDetail'];
  createChallengeCode: () => string;
  db: DatabaseAccessor;
}

const getColors = (color: string | ColorConfig): ColorConfig => {
  if (typeof color === 'string') return { buttonColor: color, primaryColor: color };
  return color;
};

export const createGlobalService = (props: Props) => {
  const { getAppConfig: getConfig, getLockDetail, createChallengeCode, db } = props;

  /**
   * 获取当前应用全局配置
   */
  const getAppConfig = async (): Promise<AppConfigResp> => {
    const { DEFAULT_COLOR, APP_NAME, LOGIN_SUBTITLE } = getConfig();
    const randIndex = Math.floor(Math.random() * DEFAULT_COLOR.length);
    const colors = getColors(DEFAULT_COLOR[randIndex]);

    const userInfo = await db.user().select().first();
    const needInit = !userInfo;

    const data: AppConfigResp = {
      appName: APP_NAME,
      loginSubtitle: LOGIN_SUBTITLE,
      ...colors,
      salt: userInfo?.passwordSalt,
      ...getLockDetail(),
    };
    if (needInit) data.needInit = true;
    return data;
  };

  /**
   * 获取挑战码
   */
  const getChallengeCode = async () => {
    return createChallengeCode();
  };

  return { getAppConfig, getChallengeCode };
};

export type GlobalService = ReturnType<typeof createGlobalService>;
