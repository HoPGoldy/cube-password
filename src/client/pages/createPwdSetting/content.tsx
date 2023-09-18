import React, { FC } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Row, Space } from 'antd';
import { useSetCreatePwdSetting } from '@/client/services/user';
import { messageSuccess } from '@/client/utils/message';
import { useIsMobile } from '@/client/layouts/responsive';
import s from './styles.module.css';
import { SettingContainerProps } from '@/client/components/settingContainer';
import { PageContent, PageAction, ActionIcon, ActionButton } from '@/client/layouts/pageWithAction';
import { LeftOutlined, RollbackOutlined } from '@ant-design/icons';
import { useAtom } from 'jotai';
import { stateUser } from '@/client/store/user';
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH } from '@/config';

export const Content: FC<SettingContainerProps> = (props) => {
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const { mutateAsync: updatePwdSetting, isLoading: isUpdatingPwdSetting } =
    useSetCreatePwdSetting();
  const [userInfo, setUserInfo] = useAtom(stateUser);

  const onSavePwdSetting = async () => {
    const values = await form.validateFields();
    const resp = await updatePwdSetting(values);
    if (resp.code !== 200) return;

    messageSuccess('密码生成规则已更新');
    setUserInfo((prev) => {
      if (!prev) return prev;
      return { ...prev, createPwdAlphabet: values.pwdAlphabet, createPwdLength: values.pwdLength };
    });
    props.onClose();
  };

  const onResetPwdSetting = async () => {
    const resp = await updatePwdSetting({
      pwdAlphabet: DEFAULT_PASSWORD_ALPHABET,
      pwdLength: DEFAULT_PASSWORD_LENGTH,
    });
    if (resp.code !== 200) return;

    messageSuccess('密码生成规则已重置');
    setUserInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        createPwdAlphabet: DEFAULT_PASSWORD_ALPHABET,
        createPwdLength: DEFAULT_PASSWORD_LENGTH,
      };
    });
    props.onClose();
  };

  const renderContent = () => {
    return (
      <Form
        className={s.changePasswordBox}
        form={form}
        labelCol={{ span: 6 }}
        labelAlign='right'
        initialValues={{
          pwdAlphabet: userInfo?.createPwdAlphabet || DEFAULT_PASSWORD_ALPHABET,
          pwdLength: userInfo?.createPwdLength || DEFAULT_PASSWORD_LENGTH,
        }}
        size={isMobile ? 'large' : 'middle'}>
        <Row className='md:mt-6'>
          <Col span={24}>
            <Form.Item
              label='密码字符集'
              name='pwdAlphabet'
              rules={[{ required: true, message: '请填写字符集' }]}>
              <Input placeholder='请填写字符集' />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label='密码长度'
              name='pwdLength'
              rules={[{ required: true, message: '请填写密码长度' }]}>
              <InputNumber precision={0} min={1} placeholder='请填写密码长度' className='w-full' />
            </Form.Item>
          </Col>
        </Row>
        <div className='w-full text-center text-gray-500 dark:text-gray-400 mb-4 cursor-default text-sm'>
          生成新密码时将从字符集中随机挑选
          <br />
          点击重置按钮可以将生成规则重置为默认值，不会影响已生成的密码
        </div>
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
            <Button onClick={onResetPwdSetting} loading={isUpdatingPwdSetting}>
              重置
            </Button>
            <Button type='primary' onClick={onSavePwdSetting} loading={isUpdatingPwdSetting}>
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
        <ActionIcon icon={<RollbackOutlined />} onClick={onResetPwdSetting} />
        <ActionButton onClick={onSavePwdSetting} loading={isUpdatingPwdSetting}>
          保存
        </ActionButton>
      </PageAction>
    </>
  );
};
