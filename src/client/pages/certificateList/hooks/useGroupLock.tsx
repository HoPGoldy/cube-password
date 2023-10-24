import { useGroup } from '@/client/store/group';
import { messageWarning } from '@/client/utils/message';
import { sha } from '@/utils/crypto';
import { Row, Col, Input, Button, Result } from 'antd';
import React, { useEffect, useState } from 'react';
import { useGroupLogin } from '@/client/services/group';
import { queryChallengeCode } from '@/client/services/global';
import { LockType } from '@/types/group';
import s from '../styles.module.css';
import { DesktopArea } from '@/client/layouts/responsive';

interface useGroupLockProps {
  groupId: number;
}

export const useGroupLock = (props: useGroupLockProps) => {
  const { groupId } = props;
  const [password, setPassword] = useState('');
  /** 输入框错误提示 */
  const [passwordError, setPasswordError] = useState(false);
  /** 请求 - 解密分组 */
  const { mutateAsync: runGroupLogin, isLoading: isLoginGroup } = useGroupLogin(groupId);
  /** 把分组设置为已解密状态 */
  const { group, updateGroup } = useGroup(groupId);
  const isTotpLock = group?.lockType === LockType.Totp;

  const resetState = () => {
    setPassword('');
    setPasswordError(false);
  };

  useEffect(() => {
    resetState();
  }, [groupId]);

  const loginWithPassword = async () => {
    const preResp = await queryChallengeCode();
    if (preResp.code !== 200 || !preResp.data) return false;

    const salt = group?.salt;
    if (!salt) {
      messageWarning('分组数据异常，请刷新页面重试');
      return false;
    }

    const code = sha(sha(salt + password) + preResp.data);
    const resp = await runGroupLogin(code);
    return resp.code === 200;
  };

  const loginWithTotp = async () => {
    const resp = await runGroupLogin(password);
    return resp.code === 200;
  };

  const onLogin = async () => {
    if (!password) {
      setPasswordError(true);
      return;
    }

    const runLogin = group?.lockType === LockType.Password ? loginWithPassword : loginWithTotp;
    const result = await runLogin();
    if (!result) return;

    // messageSuccess('分组解锁成功');
    updateGroup({ unlocked: true });
  };

  const renderGroupLogin = () => {
    return (
      <div className='mt-[15vh]'>
        <Result
          icon={<span className={`${isTotpLock ? s.totpLockIcon : s.passwordLockIcon}`}>🔒</span>}
          title='已加密'
          subTitle={`输入${isTotpLock ? '验证码' : '密码'}后解锁，登出时分组将被重新锁定`}
          extra={
            <div>
              <div className='sm:w-full md:w-1/2 xl:w-1/3 2xl:w-1/4 m-auto'>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Input.Password
                      status={passwordError ? 'error' : undefined}
                      placeholder={isTotpLock ? '请输入验证码' : '请输入分组密码'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(false);
                      }}
                      onKeyUp={(e) => {
                        if (e.key === 'Enter') onLogin();
                      }}
                    />
                  </Col>
                  <DesktopArea>
                    <Col span={24}>
                      <Button type='primary' block onClick={onLogin}>
                        解锁
                      </Button>
                    </Col>
                  </DesktopArea>
                </Row>
              </div>
            </div>
          }
        />
      </div>
    );
  };

  return { onLogin, renderGroupLogin, isLoginGroup };
};
