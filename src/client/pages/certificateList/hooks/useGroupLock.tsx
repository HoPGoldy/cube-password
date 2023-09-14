import { useGroup } from '@/client/store/group';
import { messageWarning } from '@/client/utils/message';
import { sha } from '@/utils/crypto';
import { Row, Col, Input, Button, Result } from 'antd';
import React, { useState } from 'react';
import { useGroupLogin } from '@/client/services/group';
import { useAtomValue } from 'jotai';
import { LockOutlined } from '@ant-design/icons';
import { queryChallengeCode } from '@/client/services/global';
import { stateAppConfig } from '@/client/store/global';

interface useGroupLockProps {
  groupId: number;
}

export const useGroupLock = (props: useGroupLockProps) => {
  const { groupId } = props;
  const [password, setPassword] = useState('');
  const primaryColor = useAtomValue(stateAppConfig)?.primaryColor;
  /** 输入框错误提示 */
  const [passwordError, setPasswordError] = useState(false);
  /** 请求 - 解密分组 */
  const { mutateAsync: runGroupLogin } = useGroupLogin(groupId);
  /** 把分组设置为已解密状态 */
  const { group, updateGroup } = useGroup(groupId);

  const onLogin = async () => {
    if (!password) {
      setPasswordError(true);
      return;
    }

    const preResp = await queryChallengeCode();
    if (preResp.code !== 200 || !preResp.data) return;

    const salt = group?.salt;
    if (!salt) {
      messageWarning('分组数据异常，请刷新页面重试');
      return;
    }

    const code = sha(sha(salt + password) + preResp.data);
    const resp = await runGroupLogin(code);
    if (resp.code !== 200) return;

    // messageSuccess('分组解锁成功');
    updateGroup({ unlocked: true });
  };

  const renderGroupLogin = () => {
    return (
      <div className='mt-[15vh]'>
        <Result
          icon={<LockOutlined style={{ color: primaryColor }} />}
          title='已加密'
          subTitle='输入正确密码后解锁，登出时分组将被重新锁定'
          extra={
            <div>
              <div className='sm:w-full md:w-1/2 xl:w-1/3 2xl:w-1/4 m-auto'>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Input.Password
                      status={passwordError ? 'error' : undefined}
                      placeholder='请输入分组密码'
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
                  <Col span={24}>
                    <Button type='primary' block onClick={onLogin}>
                      解锁
                    </Button>
                  </Col>
                </Row>
              </div>
            </div>
          }
        />
      </div>
    );
  };

  return { onLogin, renderGroupLogin };
};
