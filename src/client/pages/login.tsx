import { STATUS_CODE } from '@/config';
import { LoginReqData, LoginSuccessResp } from '@/types/user';
import { getAesMeta, sha } from '@/utils/crypto';
import { Alert, Button, Col, Input, InputRef, Row, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLogin } from '../services/user';
import { login, stateMainPwd, stateUser } from '../store/user';
import { messageError } from '../utils/message';
import { KeyOutlined } from '@ant-design/icons';
import { PageTitle } from '../components/pageTitle';
import { queryChallengeCode } from '../services/global';
import { useAtomValue, useSetAtom } from 'jotai';
import { stateAppConfig } from '../store/global';
import { LockDetail, LoginFailRecord } from '@/types/security';
import dayjs from 'dayjs';
import { formatLocation } from '@/utils/ipLocation';

const Login = () => {
  /** 密码 */
  const [password, setPassword] = useState('');
  /** 密码输入框 */
  const passwordInputRef = useRef<InputRef>(null);
  /** 应用配置 */
  const appConfig = useAtomValue(stateAppConfig);
  /** 提交登录 */
  const { mutateAsync: postLogin, isLoading: isLogin } = useLogin();
  /** 动态验证码 */
  const [code, setCode] = useState('');
  /** 验证码输入框 */
  const codeInputRef = useRef<InputRef>(null);
  /** 是否显示动态验证码输入框 */
  const [codeVisible, setCodeVisible] = useState(false);
  /** 当前登录失败记录 */
  const [loginFailRecord, setLoginFailRecord] = useState<LockDetail>();
  /** store 里的用户信息 */
  const userInfo = useAtomValue(stateUser);
  const setMainPwd = useSetAtom(stateMainPwd);

  useEffect(() => {
    if (!appConfig) return;
    setLoginFailRecord(appConfig);
  }, [appConfig]);

  // 临时功能，开发时自动登录
  // React.useEffect(() => {
  //   if (!password) setPassword('123123');
  //   else onSubmit();
  // }, [password]);

  const onSubmit = async () => {
    if (!password) {
      messageError('请输入密码');
      passwordInputRef.current?.focus();
      return;
    }

    const challengeResp = await queryChallengeCode();
    if (challengeResp.code !== STATUS_CODE.SUCCESS) return;

    const loginData: LoginReqData = {
      a: sha(sha(appConfig?.salt + password) + challengeResp.data),
    };
    if (code) loginData.b = code;

    const resp = await postLogin(loginData);
    if (resp.code === STATUS_CODE.NEED_CODE) {
      setCodeVisible(true);
      codeInputRef.current?.focus();
    }
    if (resp.code !== STATUS_CODE.SUCCESS) {
      setLoginFailRecord(resp.data as LockDetail);
      return;
    }

    // messageSuccess('登录成功，欢迎回来。');
    const userInfo = resp.data as LoginSuccessResp;
    const { key, iv } = getAesMeta(password);
    login(userInfo);
    setMainPwd({ pwdKey: key, pwdIv: iv });
  };

  if (userInfo) {
    return <Navigate to='/' replace />;
  }

  const renderLoginFailure = (item: LoginFailRecord) => {
    const message =
      dayjs(item.date).format('YYYY-MM-DD HH:mm:ss') +
      ' 于 ' +
      formatLocation(item.location) +
      ' 登录失败';
    return (
      <Col span={24} key={item.date}>
        <Alert message={message} type='error' showIcon />
      </Col>
    );
  };

  const renderLockResult = () => {
    return (
      <div>
        <Typography.Title level={2} className='text-center !text-red-500'>
          登录已锁定
        </Typography.Title>
        <Typography.Paragraph className='text-center !text-red-500'>
          由于登录失败次数超过上限，应用访问功能已被锁定，请重启应用服务或明天再试。
        </Typography.Paragraph>
      </div>
    );
  };

  const renderLoginForm = () => {
    return (
      <>
        <Input.Password
          size='large'
          className='mb-2'
          ref={passwordInputRef}
          autoFocus
          placeholder='请输入密码'
          prefix={<KeyOutlined />}
          autoComplete='new-password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
        />

        {codeVisible && (
          <Input
            size='large'
            className='mb-2'
            ref={codeInputRef}
            placeholder='请输入验证码'
            prefix={<KeyOutlined />}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === 'Enter') onSubmit();
            }}
          />
        )}

        <Button
          size='large'
          block
          loading={isLogin}
          type='primary'
          style={{ background: appConfig?.buttonColor }}
          onClick={onSubmit}>
          登 录
        </Button>
      </>
    );
  };

  return (
    <div className='h-screen w-screen bg-gray-100 flex flex-col justify-center items-center dark:text-gray-100'>
      <PageTitle title='登录' />
      <header className='w-screen text-center min-h-[236px]'>
        <div className='text-5xl font-bold text-mainColor'>{appConfig?.appName}</div>
        <div className='mt-4 text-xl text-mainColor'>{appConfig?.loginSubtitle}</div>
        <div className='w-[70%] my-6 mx-auto'>
          <Row gutter={[12, 12]}>{loginFailRecord?.loginFailure?.map(renderLoginFailure)}</Row>
        </div>
      </header>

      <div className='w-[70%] md:w-[40%] lg:w-[30%] xl:w-[20%] flex flex-col items-center'>
        {loginFailRecord?.isBanned ? renderLockResult() : renderLoginForm()}
      </div>
    </div>
  );
};

export default Login;
