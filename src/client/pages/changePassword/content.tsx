import React, { FC } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Space } from 'antd';
import { useChangePassword } from '@/client/services/user';
import { aes, getAesMeta, sha, validateAesMeta } from '@/utils/crypto';
import { stateMainPwd, stateUser, stateUserToken } from '@/client/store/user';
import { messageError, messageWarning } from '@/client/utils/message';
import { useIsMobile } from '@/client/layouts/responsive';
import s from './styles.module.css';
import { SettingContainerProps } from '@/client/components/settingContainer';
import { PageContent, PageAction, ActionIcon, ActionButton } from '@/client/layouts/pageWithAction';
import { LeftOutlined } from '@ant-design/icons';
import { useAtomValue } from 'jotai';
import { STATUS_CODE } from '@/config';
import { queryChallengeCode } from '@/client/services/global';
import { stateAppConfig } from '@/client/store/global';
import { ChangePasswordReqData } from '@/types/user';

export const Content: FC<SettingContainerProps> = (props) => {
  const [form] = Form.useForm();
  const userInfo = useAtomValue(stateUser);
  const appConfig = useAtomValue(stateAppConfig);
  const userToken = useAtomValue(stateUserToken);
  const mainPwdInfo = useAtomValue(stateMainPwd);
  const isMobile = useIsMobile();
  const { mutateAsync: postChangePassword, isLoading: isChangingPassword } = useChangePassword();

  const onSavePassword = async () => {
    if (!userInfo || !appConfig || !userToken || !mainPwdInfo?.pwdKey || !mainPwdInfo?.pwdIv) {
      messageError('用户信息解析错误，请重新登录');
      return;
    }

    const { oldPassword, newPassword, totp = '' } = await form.validateFields();
    if (!validateAesMeta(oldPassword, mainPwdInfo.pwdKey, mainPwdInfo.pwdIv)) {
      messageWarning('旧密码不正确');
      return;
    }

    if (validateAesMeta(newPassword, mainPwdInfo.pwdKey, mainPwdInfo.pwdIv)) {
      messageWarning('新密码不得与旧密码重复');
      return;
    }

    const challengeResp = await queryChallengeCode();
    if (challengeResp.code !== STATUS_CODE.SUCCESS) return;

    const postKey = sha(appConfig?.salt + oldPassword) + challengeResp?.data + userToken + totp;
    // console.log('🚀 ~ file: content.tsx:47 ~ onSavePassword ~ postKey:', postKey);
    const { key, iv } = getAesMeta(postKey);

    const postData: ChangePasswordReqData = { oldPassword, newPassword };
    const encryptedData = aes(JSON.stringify(postData), key, iv);
    const resp = await postChangePassword(encryptedData);
    if (resp.code !== 200) return;

    props.onClose();
    Modal.success({
      content: '密码修改成功，请重新登录',
      okText: '重新登录',
      onOk: () => {
        window.location.reload();
      },
    });
  };

  const renderContent = () => {
    return (
      <Form
        className={s.changePasswordBox}
        form={form}
        labelCol={{ span: 6 }}
        labelAlign='right'
        size={isMobile ? 'large' : 'middle'}>
        <Row className='md:mt-6'>
          <Col span={24}>
            <Form.Item
              label='旧密码'
              name='oldPassword'
              rules={[{ required: true, message: '请填写旧密码' }]}>
              <Input.Password placeholder='请输入' />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label='新密码'
              name='newPassword'
              hasFeedback
              rules={[
                { required: true, message: '请填写新密码' },
                { min: 6, message: '密码长度至少6位' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('oldPassword') !== value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('新旧密码不能相同'));
                  },
                }),
              ]}>
              <Input.Password placeholder='请输入' />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label='重复新密码'
              name='confirmPassword'
              rules={[
                { required: true, message: '请重复新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('与新密码不一致'));
                  },
                }),
              ]}>
              <Input.Password placeholder='请输入' />
            </Form.Item>
          </Col>
          {userInfo?.withTotp && (
            <Col span={24}>
              <Form.Item
                label='动态验证码'
                name='totp'
                rules={[{ required: true, message: '请输入动态验证码' }]}>
                <Input maxLength={6} placeholder='请输入' />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    );
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className='flex flex-row-reverse'>
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            <Button type='primary' onClick={onSavePassword} loading={isChangingPassword}>
              保存
            </Button>
          </Space>
        </div>
      </>
    );
  }

  return (
    <>
      <PageContent>
        <div className='m-4 md:m-0'>
          <Card size='small' className='text-center text-base font-bold mb-4'>
            {props.title}
          </Card>
          <Card size='small' className='text-base'>
            {renderContent()}
          </Card>
        </div>
      </PageContent>

      <PageAction>
        <ActionIcon icon={<LeftOutlined />} onClick={props.onClose} />
        <ActionButton onClick={onSavePassword} loading={isChangingPassword}>
          保存
        </ActionButton>
      </PageAction>
    </>
  );
};
