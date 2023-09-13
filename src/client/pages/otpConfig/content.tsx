import React, { FC, useEffect, useState } from 'react';
import Loading from '../../layouts/loading';
import { Button, Card, Space, Input, Modal, QRCode } from 'antd';
import { messageSuccess, messageWarning } from '@/client/utils/message';
import { SettingContainerProps } from '@/client/components/settingContainer';
import { useIsMobile } from '@/client/layouts/responsive';
import { ActionButton, ActionIcon, PageAction, PageContent } from '@/client/layouts/pageWithAction';
import { LeftOutlined } from '@ant-design/icons';
import { useAtomValue } from 'jotai';
import { stateUser } from '@/client/store/user';
import { useBindOtp, useFetchOtpQrCode } from '@/client/services/otp';

export const Content: FC<SettingContainerProps> = (props) => {
  const isMobile = useIsMobile();
  const userInfo = useAtomValue(stateUser);
  console.log('🚀 ~ file: content.tsx:16 ~ useContent ~ userInfo:', userInfo);
  const {
    data: otpInfo,
    isLoading: isLoadingOtpInfo,
    refetch: refetchOtpInfo,
  } = useFetchOtpQrCode();
  const { mutateAsync: bindOtp, isLoading: isBinding } = useBindOtp();
  // 绑定验证码内容
  const [initCode, setInitCode] = useState('');
  // 解绑验证码内容
  const [removeCode, setRemoveCode] = useState('');
  // 是否显示解绑弹窗
  const [removeVisible, setRemoveVisible] = useState(false);
  // 请求是否进行中
  const [submiting, setSubmiting] = useState(false);
  // 二维码是否已失效
  const [isInvalid, setIsInvalid] = useState(false);
  console.log('🚀 ~ file: content.tsx:22 ~ useContent ~ otpInfo:', otpInfo);

  const { registered, qrCode } = otpInfo?.data || {};

  const clearState = () => {
    setInitCode('');
    setRemoveCode('');
    setRemoveVisible(false);
  };

  // 二维码到了之后设置过期倒计时
  useEffect(() => {
    setIsInvalid(false);
    if (!otpInfo || registered) {
      return;
    }

    const invalidTimer = setTimeout(
      () => {
        setIsInvalid(true);
      },
      1000 * 60 * 5,
    );

    return () => {
      clearTimeout(invalidTimer);
    };
  }, [otpInfo]);

  const onSubmit = async () => {
    if (!initCode || initCode.length !== 6) {
      messageWarning('请输入正确的验证码');
      return;
    }

    const resp = await bindOtp(initCode);
    if (resp.code !== 200) return;

    clearState();
    refetchOtpInfo();
  };

  const onRemove = async () => {
    if (!removeCode || removeCode.length !== 6) {
      messageWarning('请输入正确的验证码');
      return;
    }

    // setSubmiting(true)
    // removeOtp(removeCode)
    //     .then(() => {
    //         Notify.show({ type: 'success', message: '解绑成功' })
    //     })
    //     .finally(() => {
    //         refetchOtpInfo()
    //         setSubmiting(false)
    //         setInitCode('')
    //         setRemoveCode('')
    //     })
  };

  const renderContent = () => {
    if (isLoadingOtpInfo) return <Loading />;

    if (!registered) {
      return (
        <>
          <div className='w-full flex justify-center flex-col md:flex-row'>
            <div className='relative flex justify-center items-center'>
              <QRCode
                value={qrCode || '-'}
                status={isInvalid ? 'expired' : 'active'}
                onRefresh={refetchOtpInfo}
              />
            </div>
            <div className='mt-4 md:ml-4 md:mt-2'>
              <div className='cursor-default leading-7'>
                请使用谷歌身份验证器扫描二维码，扫描完成后将会以
                <code className='bg-slate-200 dark:bg-slate-600 rounded p-1 overflow-auto mx-2'>
                  cube-passord(main password)
                </code>
                显示。
              </div>
              <div className='my-2 cursor-default text-slate-500'>
                没有身份验证器？
                <a
                  className='text-sky-500'
                  href='https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2'
                  target='__blank'>
                  点此安装
                </a>
              </div>
              <Input
                placeholder='请输入身份验证器提供的 6 位验证码'
                onChange={(e) => setInitCode(e.target.value)}
                value={initCode}
                onKeyUp={(e) => {
                  if (e.key === 'Enter') onSubmit();
                }}
              />
            </div>
          </div>

          <div className='w-full text-center text-gray-500 dark:text-gray-400 my-3 cursor-default text-sm'>
            绑定后将会在重要操作时要求提供验证码，以保证您的账户安全。
          </div>
        </>
      );
    }

    return (
      <div className='w-full flex justify-center items-center flex-col md:flex-row'>
        <div className='text-7xl m-4'>🎉</div>
        <div className='w-full'>
          <div className='text-center font-bold mb-2 text-green-500'>令牌验证已启用</div>
          <div className='text-center mb-4'>
            应用将会在异地登录、修改主密码，重置分组密码时请求令牌验证
          </div>
        </div>
        <Modal open={removeVisible} onCancel={() => setRemoveVisible(false)}>
          <div className='p-6'>
            <div className='flex items-center'>
              <Input
                placeholder='请输入 6 位验证码'
                onChange={(e) => setRemoveCode(e.target.value)}
                value={removeCode}
                onKeyUp={(e) => {
                  if (e.key === 'Enter') onRemove();
                }}
              />
            </div>
            <div className='mt-2 text-slate-500 text-center dark:text-slate-300'>
              解除绑定会导致安全性降低，请谨慎操作。
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className='flex flex-row-reverse'>
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            {registered ? (
              <Button onClick={() => setRemoveVisible(true)} loading={submiting}>
                解除绑定
              </Button>
            ) : (
              <Button type='primary' onClick={onSubmit} loading={isBinding}>
                绑定
              </Button>
            )}
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
          {renderContent()}
        </div>
      </PageContent>

      <PageAction>
        <ActionIcon icon={<LeftOutlined />} onClick={props.onClose} />
        <ActionButton>新增邀请码</ActionButton>
      </PageAction>
    </>
  );
};
